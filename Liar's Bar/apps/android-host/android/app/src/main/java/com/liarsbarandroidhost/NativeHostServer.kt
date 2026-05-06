package com.liarsbarandroidhost

import android.content.Context
import fi.iki.elonen.NanoHTTPD
import fi.iki.elonen.NanoWSD
import fi.iki.elonen.NanoWSD.WebSocket
import fi.iki.elonen.NanoWSD.WebSocketFrame
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.util.LinkedHashMap
import java.net.NetworkInterface
import java.util.Collections
import java.util.Locale
import java.util.Timer
import java.util.TimerTask
import kotlin.math.max
import kotlin.random.Random

private const val ROOM_ID = "default"
private const val MAX_PLAYERS = 8
private const val MAX_BULLETS = 8
private const val ROUND_INITIAL_BULLETS = 1
private const val MAX_REMEMBERED_COMMANDS = 512
private const val MAX_GAME_EVENT_LOG = 256
private const val INACTIVE_LOBBY_PLAYER_TIMEOUT_MS = 120000L
private const val DISCONNECTED_LOBBY_PLAYER_TIMEOUT_MS = 20000L
private const val ROOM_CLEANUP_INTERVAL_MS = 5000L
private const val LAN_IP_CACHE_MS = 3000L
private const val PRESENCE_PERSIST_INTERVAL_MS = 30000L
private const val PLAYER_DATA_SCHEMA_VERSION = "player-name-id-v1"
private const val BROADCAST_FLUSH_MS = 16L
private const val DISCONNECTED_AUTO_ACTION_DELAY_MS = 3000L
private const val AUTO_RESOLVE_PENALTY_DELAY_MS = 450L
private val HOST_FORCED_STATE_BROADCAST_ACTIONS = setOf(
  "startGame",
  "dealCards",
  "changeGameMode",
  "returnToRoom"
)
private val IMMEDIATE_BROADCAST_ACTIONS = HOST_FORCED_STATE_BROADCAST_ACTIONS + setOf(
  "addBullets",
  "playCards",
  "trust",
  "challenge",
  "refuseBullets",
  "fireGun",
  "restartRound",
  "discardTexasCard",
  "exitTexasRound"
)
private val TEXAS_ACTION_STAGES = setOf("preFlop", "flop", "turn", "river")

class NativeHostServer(
  private val context: Context,
  private val hostPort: Int,
  private val onSnapshotChanged: ((JSONObject, JSONObject) -> Unit)? = null
) : NanoWSD(hostPort) {
  private val scoreboardPrefs = context.getSharedPreferences("liars_bar_scoreboard", Context.MODE_PRIVATE)
  private val game = NativeGame(loadPersistedScoreboard()) { entries -> savePersistedScoreboard(entries) }
  private val gameLock = Any()
  private val clients = Collections.synchronizedSet(mutableSetOf<HostSocket>())
  private val socketPlayers = Collections.synchronizedMap(mutableMapOf<HostSocket, String>())
  private val gameEventLog = Collections.synchronizedList(mutableListOf<GameEventEntry>())
  private val broadcastLock = Any()
  private val pendingBroadcastEvents = mutableListOf<GameEventEntry>()
  private val roomCleanupTimer = Timer("LiarsBarRoomCleanup-$hostPort", true)
  private val disconnectedAutoActionTimer = Timer("LiarsBarDisconnectedAutoAction-$hostPort", true)
  private val autoResolvePenaltyTimer = Timer("LiarsBarAutoResolvePenalty-$hostPort", true)
  private val disconnectedAutoActionTasks = Collections.synchronizedMap(mutableMapOf<String, TimerTask>())
  private val processedCommands = Collections.synchronizedMap(
    object : LinkedHashMap<String, JSONObject>(MAX_REMEMBERED_COMMANDS, 0.75f, true) {
      override fun removeEldestEntry(eldest: MutableMap.MutableEntry<String, JSONObject>?): Boolean {
        return size > MAX_REMEMBERED_COMMANDS
      }
    }
  )
  private var cachedLanIp = "127.0.0.1"
  private var cachedLanIpAt = 0L
  private var version = 0
  private var pendingBroadcastHostInfo = false
  private var broadcastFlushScheduled = false

  init {
    roomCleanupTimer.scheduleAtFixedRate(
      object : TimerTask() {
        override fun run() {
          cleanupInactiveRoomPlayers()
        }
      },
      ROOM_CLEANUP_INTERVAL_MS,
      ROOM_CLEANUP_INTERVAL_MS
    )
  }

  override fun serveHttp(session: IHTTPSession): Response {
    if (session.uri == "/host-info") {
      return jsonResponse(hostInfo())
    }

    return serveAsset(session.uri)
  }

  override fun openWebSocket(handshake: IHTTPSession): WebSocket {
    return HostSocket(handshake)
  }

  fun getHostInfo(): JSONObject = hostInfo()

  fun getGameState(): JSONObject = synchronized(gameLock) { game.toClientJson(null) }

  fun shutdownAndClear() {
    roomCleanupTimer.cancel()
    disconnectedAutoActionTimer.cancel()
    autoResolvePenaltyTimer.cancel()
    val snapshot = synchronized(clients) { clients.toList() }
    snapshot.forEach { socket ->
      try {
        socket.close(WebSocketFrame.CloseCode.NormalClosure, "Host app closed", false)
      } catch (_: Exception) {
      }
    }

    synchronized(gameLock) {
      game.clearServerState()
      processedCommands.clear()
      gameEventLog.clear()
      version += 1
    }
    synchronized(broadcastLock) {
      pendingBroadcastEvents.clear()
      pendingBroadcastHostInfo = false
      broadcastFlushScheduled = false
    }
    disconnectedAutoActionTasks.clear()
    socketPlayers.clear()
    clients.clear()
  }

  private fun loadPersistedScoreboard(): List<LeaderboardEntry> {
    if (scoreboardPrefs.getString("playerDataSchemaVersion", "") != PLAYER_DATA_SCHEMA_VERSION) {
      scoreboardPrefs.edit()
        .clear()
        .putString("playerDataSchemaVersion", PLAYER_DATA_SCHEMA_VERSION)
        .apply()
      return emptyList()
    }

    val raw = scoreboardPrefs.getString("scoreboard", "[]") ?: "[]"
    return try {
      val array = JSONArray(raw)
      (0 until array.length()).mapNotNull { index ->
        val item = array.optJSONObject(index) ?: return@mapNotNull null
        val playerId = item.optString("playerId", "")
        val name = item.optString("name", "")
        if (playerId.isBlank() || name.isBlank()) return@mapNotNull null
        LeaderboardEntry(
          playerId = playerId,
          name = name,
          score = item.optInt("score", 0),
          isActive = false,
          lastSeen = item.optLong("lastSeen", 0L)
        )
      }
    } catch (_: Exception) {
      emptyList()
    }
  }

  private fun savePersistedScoreboard(entries: List<LeaderboardEntry>) {
    scoreboardPrefs.edit()
      .putString("playerDataSchemaVersion", PLAYER_DATA_SCHEMA_VERSION)
      .putString("scoreboard", JSONArray(entries.map { it.json() }).toString())
      .apply()
  }

  private inner class HostSocket(handshake: IHTTPSession) : WebSocket(handshake) {
    override fun onOpen() {
      clients.add(this)
      sendJson(message("hostInfo", data = hostInfo()))
    }

    override fun onClose(code: WebSocketFrame.CloseCode?, reason: String?, initiatedByRemote: Boolean) {
      detachSocket(this)
    }

    override fun onMessage(message: WebSocketFrame?) {
      val raw = message?.textPayload ?: return
      val incoming = try {
        JSONObject(raw)
      } catch (_: Exception) {
        sendError(null, "INVALID_MESSAGE", "Message must be valid JSON")
        return
      }

      val commandId = incoming.optString("commandId", "")
      if (incoming.has("roomId") && incoming.optString("roomId") != ROOM_ID) {
        sendError(commandId, "INVALID_ROOM", "Host only supports the default room")
        return
      }
      val playerId = canonicalPlayerId(incoming)
      if (playerId.isBlank()) {
        sendError(commandId, "INVALID_MESSAGE", "Missing playerId")
        return
      }
      if (commandId.isBlank()) {
        sendError(null, "INVALID_MESSAGE", "Missing commandId")
        return
      }

      val dedupeKey = "$playerId:$commandId"
      socketPlayers[this] = playerId
      clearDisconnectedAutoAction(playerId)
      var connectionEvent: GameEventEntry? = null
      synchronized(gameLock) {
        val beforeState = game.toServerJson()
        val changed = game.markConnected(playerId)
        if (changed) {
          val baseVersion = version
          version += 1
          connectionEvent = rememberGameEvent(baseVersion, "playerConnected", playerId, beforeState, game.toServerJson())
        }
      }
      connectionEvent?.let { broadcastGameEvent(it, includeHostInfo = true) }

      replayProcessedCommand(dedupeKey)?.let { response ->
        sendJson(response)
        if (incoming.optString("type") != "ping") {
          sendReplayEventsOrSnapshot(
            this,
            incoming.optInt("version", 0),
            incoming.optString("type") == "command" ||
              incoming.optJSONObject("payload")?.optBoolean("hasGameState", false) == true
          )
        }
        return
      }

      when (incoming.optString("type")) {
        "ping" -> {
          val response = message("pong", commandId = commandId)
          sendJson(response)
          rememberProcessedCommand(dedupeKey, response)
        }
        "sync" -> {
          val response = message("ack", commandId = commandId, data = JSONObject().put("synced", true))
          sendJson(response)
          rememberProcessedCommand(dedupeKey, response)
          sendJson(message("hostInfo", data = hostInfo()))
          sendReplayEventsOrSnapshot(
            this,
            incoming.optInt("version", 0),
            incoming.optJSONObject("payload")?.optBoolean("hasGameState", false) == true
          )
        }
        "command" -> handleCommand(this, incoming, commandId, playerId, dedupeKey)
        else -> {
          val response = sendError(commandId, "INVALID_MESSAGE", "Unsupported message type")
          rememberProcessedCommand(dedupeKey, response)
        }
      }
    }

    override fun onPong(pong: WebSocketFrame?) = Unit

    override fun onException(exception: IOException?) {
      detachSocket(this)
    }

    fun sendJson(payload: JSONObject) {
      try {
        send(payload.toString())
      } catch (_: Exception) {
        detachSocket(this)
      }
    }
  }

  private fun canonicalPlayerId(incoming: JSONObject): String {
    if (incoming.optString("type") == "command" && incoming.optString("action") == "joinGame") {
      val payload = incoming.optJSONObject("payload")
      val playerName = payload?.optString("playerName", "")?.trim().orEmpty()
      if (playerName.isNotBlank()) {
        incoming.put("playerId", playerName)
        payload?.put("playerName", playerName)
        return playerName
      }
    }

    return incoming.optString("playerId", "").trim()
  }

  private fun handleCommand(
    socket: HostSocket,
    incoming: JSONObject,
    commandId: String,
    playerId: String,
    dedupeKey: String
  ) {
    val action = incoming.optString("action", "")
    val payload = incoming.optJSONObject("payload") ?: JSONObject()
    var event: GameEventEntry? = null
    val result = synchronized(gameLock) {
      val beforeState = game.toServerJson()
      game.apply(action, playerId, payload).also { applied ->
        if (applied.changed) {
          val baseVersion = version
          version += 1
          event = rememberGameEvent(baseVersion, action, playerId, beforeState, game.toServerJson())
        }
      }
    }

    if (!result.ok) {
      val response = socket.sendError(commandId, result.code, result.message)
      rememberProcessedCommand(dedupeKey, response)
      return
    }

    val ackData = JSONObject().put("replayedCommand", false)
    result.data?.let { data ->
      val keys = data.keys()
      while (keys.hasNext()) {
        val key = keys.next()
        ackData.put(key, data.opt(key))
      }
    }

    val response = message(
      "ack",
      commandId = commandId,
      data = ackData
    )
    socket.sendJson(response)
    rememberProcessedCommand(dedupeKey, response)

    if (event != null) {
      val includeHostInfo = shouldBroadcastHostInfo(action)
      if (shouldBroadcastImmediately(action)) {
        broadcastGameEventImmediately(event!!, includeHostInfo = includeHostInfo)
      } else {
        broadcastGameEvent(event!!, includeHostInfo = includeHostInfo)
      }
      if (action == "fireGun" && result.data?.has("penaltyResult") == true) {
        scheduleAutoResolvePenalty(playerId)
      }
      scheduleDisconnectedActorAutoActions()
    } else if (action == "getGameState") {
      sendState(socket)
    }
  }

  private fun HostSocket.sendError(commandId: String?, code: String, text: String): JSONObject {
    val response = message("error", commandId = commandId).put(
      "error",
      JSONObject()
        .put("code", code)
        .put("message", text)
        .put("retryable", false)
    )
    sendJson(response)
    return response
  }

  private fun rememberProcessedCommand(dedupeKey: String, response: JSONObject) {
    processedCommands[dedupeKey] = response
  }

  private fun replayProcessedCommand(dedupeKey: String): JSONObject? {
    return processedCommands[dedupeKey]
  }

  private fun detachSocket(socket: HostSocket) {
    clients.remove(socket)
    val playerId = socketPlayers.remove(socket) ?: return
    val stillConnected = synchronized(socketPlayers) {
      socketPlayers.values.any { it == playerId }
    }
    var event: GameEventEntry? = null
    if (!stillConnected) {
      synchronized(gameLock) {
        val beforeState = game.toServerJson()
        val changed = game.removeDisconnectedLobbyPlayerOrMarkDisconnected(playerId)
        if (changed) {
          val baseVersion = version
          version += 1
          val action = if (game.hasPlayer(playerId)) "playerDisconnected" else "playerLeft"
          event = rememberGameEvent(baseVersion, action, playerId, beforeState, game.toServerJson())
        }
      }
    }
    event?.let {
      broadcastGameEvent(it, includeHostInfo = true)
      scheduleDisconnectedActorAutoActions()
    }
  }

  private fun sendState(socket: HostSocket) {
    val viewerId = socketPlayers[socket] ?: return
    val state = synchronized(gameLock) { game.toClientJson(viewerId) }
    socket.sendJson(message("gameState", data = state))
  }

  private fun sendGameEvent(socket: HostSocket, event: GameEventEntry) {
    val viewerId = socketPlayers[socket]
    val payload = message("gameEvent", data = createGameEventPayload(event, viewerId))
    payload.put("version", event.version)
    socket.sendJson(payload)
  }

  private fun broadcastGameEvent(event: GameEventEntry, includeHostInfo: Boolean = false) {
    var shouldSchedule = false
    synchronized(broadcastLock) {
      pendingBroadcastEvents.add(event)
      pendingBroadcastHostInfo = pendingBroadcastHostInfo || includeHostInfo
      if (!broadcastFlushScheduled) {
        broadcastFlushScheduled = true
        shouldSchedule = true
      }
    }

    if (shouldSchedule) {
      Thread {
        try {
          Thread.sleep(BROADCAST_FLUSH_MS)
        } catch (_: InterruptedException) {
        }
        flushBroadcastQueue()
      }.start()
    }
  }

  private fun flushBroadcastQueue() {
    val events: List<GameEventEntry>
    val includeHostInfo: Boolean
    synchronized(broadcastLock) {
      events = pendingBroadcastEvents.toList()
      pendingBroadcastEvents.clear()
      includeHostInfo = pendingBroadcastHostInfo
      pendingBroadcastHostInfo = false
      broadcastFlushScheduled = false
    }

    if (events.isEmpty() && !includeHostInfo) {
      return
    }

    val snapshot = synchronized(clients) { clients.toList() }
    events.forEach { event ->
      snapshot.forEach { sendGameEvent(it, event) }
    }

    if (includeHostInfo) {
      val infoMessage = message("hostInfo", data = hostInfo())
      snapshot.forEach { it.sendJson(infoMessage) }
    }

    notifySnapshotChanged()
  }

  private fun broadcastGameEventImmediately(event: GameEventEntry, includeHostInfo: Boolean = false) {
    flushBroadcastQueue()

    val snapshot = synchronized(clients) { clients.toList() }
    snapshot.forEach { sendGameEvent(it, event) }

    if (includeHostInfo) {
      val infoMessage = message("hostInfo", data = hostInfo())
      snapshot.forEach { it.sendJson(infoMessage) }
    }

    notifySnapshotChanged()
  }

  private fun clearDisconnectedAutoAction(playerId: String) {
    val task = synchronized(disconnectedAutoActionTasks) {
      disconnectedAutoActionTasks.remove(playerId)
    }
    task?.cancel()
  }

  private fun scheduleDisconnectedAutoAction(playerId: String) {
    val task = synchronized(disconnectedAutoActionTasks) {
      if (disconnectedAutoActionTasks.containsKey(playerId)) {
        null
      } else {
        object : TimerTask() {
          override fun run() {
            synchronized(disconnectedAutoActionTasks) {
              disconnectedAutoActionTasks.remove(playerId)
            }

            var event: GameEventEntry? = null
            synchronized(gameLock) {
              val beforeState = game.toServerJson()
              val changed = game.autoOperateDisconnectedPlayer(playerId)
              if (changed) {
                val baseVersion = version
                version += 1
                event = rememberGameEvent(baseVersion, "autoOperateDisconnectedPlayer", playerId, beforeState, game.toServerJson())
              }
            }

            event?.let {
              broadcastGameEvent(it, includeHostInfo = false)
              scheduleDisconnectedActorAutoActions()
            }
          }
        }.also { disconnectedAutoActionTasks[playerId] = it }
      }
    } ?: return

    disconnectedAutoActionTimer.schedule(task, DISCONNECTED_AUTO_ACTION_DELAY_MS)
  }

  private fun scheduleDisconnectedActorAutoActions() {
    val actorId = synchronized(gameLock) { game.disconnectedAutoActorId() } ?: return
    scheduleDisconnectedAutoAction(actorId)
  }

  private fun scheduleAutoResolvePenalty(actorPlayerId: String) {
    autoResolvePenaltyTimer.schedule(
      object : TimerTask() {
        override fun run() {
          var event: GameEventEntry? = null
          synchronized(gameLock) {
            val beforeState = game.toServerJson()
            val changed = game.autoResolvePenalty()
            if (changed) {
              val baseVersion = version
              version += 1
              event = rememberGameEvent(baseVersion, "autoResolvePenalty", actorPlayerId, beforeState, game.toServerJson())
            }
          }
          event?.let {
            broadcastGameEventImmediately(it, includeHostInfo = false)
            scheduleDisconnectedActorAutoActions()
          }
        }
      },
      AUTO_RESOLVE_PENALTY_DELAY_MS
    )
  }

  private fun cleanupInactiveRoomPlayers() {
    var event: GameEventEntry? = null
    synchronized(gameLock) {
      val beforeState = game.toServerJson()
      val changed = game.cleanupInactiveLobbyPlayers(System.currentTimeMillis())
      if (changed) {
        val baseVersion = version
        version += 1
        event = rememberGameEvent(baseVersion, "cleanupInactivePlayers", "", beforeState, game.toServerJson())
      }
    }

    event?.let { broadcastGameEvent(it, includeHostInfo = true) }
  }

  private fun sendReplayEventsOrSnapshot(socket: HostSocket, requestedVersion: Int, hasGameState: Boolean) {
    if (hasGameState) {
      val replay = synchronized(gameEventLog) {
        val firstEvent = gameEventLog.firstOrNull()
        if (requestedVersion >= version) {
          ReplayResult(true, emptyList())
        } else if (firstEvent == null || requestedVersion < firstEvent.baseVersion) {
          ReplayResult(false, emptyList())
        } else {
          ReplayResult(true, gameEventLog.filter { it.version > requestedVersion })
        }
      }

      if (replay.ok) {
        replay.events.forEach { sendGameEvent(socket, it) }
        return
      }
    }

    sendState(socket)
  }

  private data class ReplayResult(
    val ok: Boolean,
    val events: List<GameEventEntry>
  )

  private fun rememberGameEvent(
    baseVersion: Int,
    action: String,
    actorPlayerId: String,
    beforeState: JSONObject,
    afterState: JSONObject
  ): GameEventEntry {
    val event = GameEventEntry(
      eventId = "$ROOM_ID:$version",
      baseVersion = baseVersion,
      version = version,
      action = action,
      actorPlayerId = actorPlayerId,
      beforeState = JSONObject(beforeState.toString()),
      afterState = JSONObject(afterState.toString())
    )

    synchronized(gameEventLog) {
      gameEventLog.add(event)
      while (gameEventLog.size > MAX_GAME_EVENT_LOG) {
        gameEventLog.removeAt(0)
      }
    }

    return event
  }

  private fun createGameEventPayload(event: GameEventEntry, viewerId: String?): JSONObject {
    val beforeState = createClientStateFromSnapshot(event.beforeState, viewerId)
    val afterState = createClientStateFromSnapshot(event.afterState, viewerId)

    return JSONObject()
      .put("eventId", event.eventId)
      .put("action", event.action)
      .put("actorPlayerId", event.actorPlayerId)
      .put("baseVersion", event.baseVersion)
      .put("version", event.version)
      .put("patch", createGamePatch(beforeState, afterState))
  }

  private fun createClientStateFromSnapshot(snapshot: JSONObject, viewerId: String?): JSONObject {
    val state = JSONObject(snapshot.toString())
    val players = state.optJSONArray("players") ?: JSONArray()
    val maskedPlayers = JSONArray()

    for (index in 0 until players.length()) {
      val player = players.optJSONObject(index) ?: continue
      val nextPlayer = JSONObject(player.toString())
      val playerId = nextPlayer.optString("id", "")
      if (playerId != viewerId) {
        nextPlayer.put("cards", hiddenCards(playerId, nextPlayer.optJSONArray("cards")?.length() ?: 0))
      }
      maskedPlayers.put(nextPlayer)
    }

    state.put("players", maskedPlayers)
    state.put("currentPlay", maskPlayRecord(state, state.optJSONObject("currentPlay")) ?: JSONObject.NULL)

    val history = state.optJSONArray("playHistory") ?: JSONArray()
    val maskedHistory = JSONArray()
    for (index in 0 until history.length()) {
      val record = history.optJSONObject(index)
      maskedHistory.put(maskPlayRecord(state, record) ?: JSONObject.NULL)
    }
    state.put("playHistory", maskedHistory)

    return state
  }

  private fun hiddenCards(playerId: String, count: Int): JSONArray {
    val cards = JSONArray()
    for (index in 0 until count) {
      cards.put(JSONObject().put("id", "hidden-$playerId-$index").put("rank", "Joker"))
    }
    return cards
  }

  private fun maskPlayRecord(state: JSONObject, record: JSONObject?): JSONObject? {
    if (record == null) return null
    if (record.optBoolean("isChallenged", false)) return JSONObject(record.toString())

    val masked = JSONObject(record.toString())
    val declaredCount = masked.optInt("declaredCount", masked.optJSONArray("cards")?.length() ?: 0)
    val playerId = masked.optString("playerId", "play")
    val mainCard = state.optString("mainCard", "Q")
    val cards = JSONArray()

    for (index in 0 until declaredCount) {
      cards.put(JSONObject().put("id", "declared-$playerId-$index").put("rank", mainCard))
    }

    masked.put("cards", cards)
    return masked
  }

  private fun createGamePatch(beforeState: JSONObject, afterState: JSONObject): JSONObject {
    val patch = JSONObject()
    val set = JSONObject()
    val keys = jsonKeys(beforeState).apply {
      addAll(jsonKeys(afterState))
      remove("players")
    }

    keys.forEach { key ->
      val beforeValue = beforeState.opt(key)
      val afterValue = afterState.opt(key)
      if (!jsonValuesEqual(beforeValue, afterValue)) {
        set.put(key, cloneJsonValue(afterValue))
      }
    }

    if (set.length() > 0) {
      patch.put("set", set)
    }

    val beforePlayers = beforeState.optJSONArray("players") ?: JSONArray()
    val afterPlayers = afterState.optJSONArray("players") ?: JSONArray()
    val beforeById = playersById(beforePlayers)
    val afterById = playersById(afterPlayers)
    val changedPlayers = JSONArray()
    val removedPlayerIds = JSONArray()

    afterById.forEach { (playerId, player) ->
      if (!jsonValuesEqual(beforeById[playerId], player)) {
        changedPlayers.put(JSONObject(player.toString()))
      }
    }

    beforeById.keys.forEach { playerId ->
      if (!afterById.containsKey(playerId)) {
        removedPlayerIds.put(playerId)
      }
    }

    val beforeOrder = playerOrder(beforePlayers)
    val afterOrder = playerOrder(afterPlayers)

    if (changedPlayers.length() > 0) patch.put("players", changedPlayers)
    if (removedPlayerIds.length() > 0) patch.put("removePlayerIds", removedPlayerIds)
    if (beforeOrder.toString() != afterOrder.toString()) patch.put("playerOrder", afterOrder)

    return patch
  }

  private fun jsonKeys(obj: JSONObject): MutableSet<String> {
    val keys = mutableSetOf<String>()
    val iterator = obj.keys()
    while (iterator.hasNext()) {
      keys.add(iterator.next())
    }
    return keys
  }

  private fun jsonValuesEqual(left: Any?, right: Any?): Boolean {
    return jsonValueString(left) == jsonValueString(right)
  }

  private fun jsonValueString(value: Any?): String {
    return when (value) {
      null, JSONObject.NULL -> "null"
      is JSONObject -> value.toString()
      is JSONArray -> value.toString()
      else -> value.toString()
    }
  }

  private fun cloneJsonValue(value: Any?): Any {
    return when (value) {
      null, JSONObject.NULL -> JSONObject.NULL
      is JSONObject -> JSONObject(value.toString())
      is JSONArray -> JSONArray(value.toString())
      else -> value
    }
  }

  private fun playersById(players: JSONArray): LinkedHashMap<String, JSONObject> {
    val byId = linkedMapOf<String, JSONObject>()
    for (index in 0 until players.length()) {
      val player = players.optJSONObject(index) ?: continue
      val playerId = player.optString("id", "")
      if (playerId.isNotBlank()) {
        byId[playerId] = player
      }
    }
    return byId
  }

  private fun playerOrder(players: JSONArray): JSONArray {
    val order = JSONArray()
    for (index in 0 until players.length()) {
      val playerId = players.optJSONObject(index)?.optString("id", "").orEmpty()
      if (playerId.isNotBlank()) {
        order.put(playerId)
      }
    }
    return order
  }

  private fun shouldBroadcastHostInfo(action: String): Boolean {
    return action == "joinGame" ||
      action == "leaveGame" ||
      action == "changeGameMode" ||
      action == "returnToRoom"
  }

  private fun shouldBroadcastImmediately(action: String): Boolean {
    return IMMEDIATE_BROADCAST_ACTIONS.contains(action)
  }

  private fun notifySnapshotChanged() {
    onSnapshotChanged?.invoke(getHostInfo(), getGameState())
  }

  private fun message(type: String, commandId: String? = null, data: JSONObject? = null): JSONObject {
    val payload = JSONObject()
      .put("type", type)
      .put("roomId", ROOM_ID)
      .put("version", version)
      .put("timestamp", System.currentTimeMillis())

    if (commandId != null) payload.put("commandId", commandId)
    if (data != null) payload.put("data", data)
    return payload
  }

  private fun hostInfo(): JSONObject {
    val ip = lanIp()
    val joinUrl = "http://$ip:$hostPort/login?hostAddress=$ip&hostPort=$hostPort"
    val (mode, playerCount, startedAt) = synchronized(gameLock) {
      Triple(game.gameMode, game.players.size, game.startedAt)
    }
    return JSONObject()
      .put("platform", "android-native")
      .put("ip", ip)
      .put("lanIp", ip)
      .put("port", hostPort)
      .put("name", "Liar's Bar Android Host")
      .put("hostName", "Liar's Bar Android Host")
      .put("localUrl", "http://127.0.0.1:$hostPort/")
      .put("joinUrl", joinUrl)
      .put("qrText", joinUrl)
      .put("wsUrl", "ws://$ip:$hostPort")
      .put("gameMode", mode)
      .put("playerCount", playerCount)
      .put("maxPlayers", MAX_PLAYERS)
      .put("startedAt", startedAt)
  }

  private fun jsonResponse(data: JSONObject): Response {
    return newFixedLengthResponse(Response.Status.OK, "application/json; charset=utf-8", data.toString()).apply {
      addHeader("Access-Control-Allow-Origin", "*")
    }
  }

  private fun serveAsset(uri: String): Response {
    val cleanUri = uri.substringBefore("?").trim('/').replace("..", "")
    val candidates = buildList {
      if (cleanUri.isBlank()) {
        add("web/index.html")
      } else {
        add("web/$cleanUri")
        add("web/$cleanUri/index.html")
      }
      add("web/index.html")
    }

    for (assetPath in candidates) {
      try {
        val input = context.assets.open(assetPath)
        return newChunkedResponse(Response.Status.OK, mimeType(assetPath), input)
      } catch (_: IOException) {
        // Try next candidate.
      }
    }

    return newFixedLengthResponse(Response.Status.NOT_FOUND, "text/plain; charset=utf-8", "Not found")
  }

  private fun mimeType(path: String): String {
    return when (path.substringAfterLast('.', "").lowercase(Locale.US)) {
      "html" -> "text/html; charset=utf-8"
      "js" -> "application/javascript; charset=utf-8"
      "css" -> "text/css; charset=utf-8"
      "json" -> "application/json; charset=utf-8"
      "png" -> "image/png"
      "jpg", "jpeg" -> "image/jpeg"
      "svg" -> "image/svg+xml"
      "ico" -> "image/x-icon"
      "txt" -> "text/plain; charset=utf-8"
      else -> "application/octet-stream"
    }
  }

  private fun lanIp(): String {
    val now = System.currentTimeMillis()
    if (now - cachedLanIpAt < LAN_IP_CACHE_MS) {
      return cachedLanIp
    }

    val nextIp = try {
      NetworkInterface.getNetworkInterfaces().toList()
        .flatMap { it.inetAddresses.toList() }
        .firstOrNull { address ->
          !address.isLoopbackAddress &&
            address.hostAddress?.contains(':') == false &&
            !address.hostAddress.orEmpty().startsWith("169.254.")
        }
        ?.hostAddress ?: "127.0.0.1"
    } catch (_: Exception) {
      "127.0.0.1"
    }
    cachedLanIp = nextIp
    cachedLanIpAt = now
    return nextIp
  }

}

private data class CommandResult(
  val ok: Boolean,
  val changed: Boolean = false,
  val code: String = "INVALID_ACTION_STATE",
  val message: String = "Invalid action",
  val data: JSONObject? = null
)

private data class GameEventEntry(
  val eventId: String,
  val baseVersion: Int,
  val version: Int,
  val action: String,
  val actorPlayerId: String,
  val beforeState: JSONObject,
  val afterState: JSONObject
)

private data class Card(
  val id: String,
  val rank: String,
  val suit: String? = null
) {
  fun json(): JSONObject {
    val obj = JSONObject().put("id", id).put("rank", rank)
    if (suit != null) obj.put("suit", suit)
    return obj
  }
}

private data class Player(
  val id: String,
  var name: String,
  var cards: MutableList<Card> = mutableListOf(),
  var isEliminated: Boolean = false,
  var isActive: Boolean = true,
  var bullets: Int = 0,
  var initialBullets: Int = 0,
  var score: Int = 0,
  var gameState: String = "waiting",
  var isReady: Boolean = false,
  var isHost: Boolean = false,
  var hasAddedBullets: Boolean = false,
  var bulletCount: Int = 0,
  var totalChambers: Int = MAX_BULLETS,
  var isSurvivor: Boolean = false,
  var connectionStatus: String = "connected",
  var lastSeen: Long = System.currentTimeMillis(),
  var unreadySince: Long = if (isHost) 0L else System.currentTimeMillis(),
  var texasRoundState: String = "waiting",
  var texasLastAction: String? = null
) {
  fun resetForRoom() {
    cards.clear()
    isEliminated = false
    isActive = true
    bullets = 0
    initialBullets = 0
    gameState = "waiting"
    isReady = false
    unreadySince = if (isHost) 0L else System.currentTimeMillis()
    hasAddedBullets = false
    bulletCount = 0
    totalChambers = MAX_BULLETS
    isSurvivor = false
    texasRoundState = "waiting"
    texasLastAction = null
  }

  fun setPlaying(resetBullets: Boolean = false) {
    isEliminated = false
    isActive = true
    gameState = "playing"
    hasAddedBullets = false
    isSurvivor = false
    if (resetBullets) bulletCount = 0
  }

  fun setEliminated() {
    isEliminated = true
    isActive = false
    gameState = "eliminated"
    hasAddedBullets = false
  }

  fun json(viewerId: String?): JSONObject {
    return JSONObject()
      .put("id", id)
      .put("name", name)
      .put("cards", JSONArray(cards.mapIndexed { index, card ->
        if (viewerId == id) card.json() else Card("hidden-$id-$index", "Joker").json()
      }))
      .put("isEliminated", isEliminated)
      .put("isActive", isActive)
      .put("bullets", bullets)
      .put("initialBullets", initialBullets)
      .put("score", score)
      .put("gameState", gameState)
      .put("isReady", isReady)
      .put("isHost", isHost)
      .put("hasAddedBullets", hasAddedBullets)
      .put("bulletCount", bulletCount)
      .put("totalChambers", totalChambers)
      .put("isSurvivor", isSurvivor)
      .put("connectionStatus", connectionStatus)
      .put("lastSeen", lastSeen)
      .put("texasRoundState", texasRoundState)
      .put("texasLastAction", texasLastAction ?: JSONObject.NULL)
  }
}

private data class PlayRecord(
  val playerId: String,
  val cards: List<Card>,
  val declaredCount: Int,
  var isChallenged: Boolean = false,
  var challengeResult: Boolean? = null
) {
  fun json(mainCard: String, reveal: Boolean): JSONObject {
    val displayCards = if (reveal) {
      cards
    } else {
      List(declaredCount) { index -> Card("declared-$playerId-$index", mainCard) }
    }
    return JSONObject()
      .put("playerId", playerId)
      .put("cards", JSONArray(displayCards.map { it.json() }))
      .put("declaredCount", declaredCount)
      .put("isChallenged", isChallenged)
      .put("challengeResult", challengeResult ?: JSONObject.NULL)
  }
}

private data class TexasEvaluation(
  val category: Int,
  val ranks: List<Int>,
  val cards: List<Card> = emptyList()
)

private data class LeaderboardEntry(
  val playerId: String,
  val name: String,
  val score: Int,
  val isActive: Boolean,
  val lastSeen: Long
) {
  fun json(): JSONObject {
    return JSONObject()
      .put("playerId", playerId)
      .put("name", name)
      .put("score", score)
      .put("isActive", isActive)
      .put("lastSeen", lastSeen)
  }
}

private class NativeGame(
  initialScoreboard: List<LeaderboardEntry> = emptyList(),
  private val onScoreboardChanged: ((List<LeaderboardEntry>) -> Unit)? = null
) {
  val startedAt: Long = System.currentTimeMillis()
  val players = mutableListOf<Player>()
  var gameMode: String = "liarsBar"
  private var gameStatus = "waiting"
  private var mainCard = "Q"
  private var currentPlayerIndex = 0
  private var turnActorPlayerId: String? = null
  private var currentPlay: PlayRecord? = null
  private val playHistory = mutableListOf<PlayRecord>()
  private val liarsTurnCyclePlayedPlayerIds = mutableSetOf<String>()
  private val completedLiarsPlayerIds = mutableListOf<String>()
  private var round = 0
  private var roundStarterPlayerId: String? = null
  private var lastAddedBullets = 0
  private var pendingPenaltyPlayerId: String? = null
  private var penaltyAwardPlayerId: String? = null
  private var penaltyResult: JSONObject? = null
  private var deck = mutableListOf<Card>()
  private val communityCards = mutableListOf<Card>()
  private var pendingTexasDiscardPlayerId: String? = null
  private var pendingTexasActionStageAfterPreDraw: String? = null
  private var pendingTexasExitPlayerId: String? = null
  private var texasStage = "idle"
  private var texasHoldemRound = 0
  private var texasPendingWinnerScore = 0
  private var texasRoundResult: JSONObject? = null
  private var roundSettlement: JSONObject? = null
  private var lastActivePlayerId: String? = null
  private val roundScoreBaseline = linkedMapOf<String, Int>()
  private val liarsInitialHands = linkedMapOf<String, List<Card>>()
  private val scoreboard = linkedMapOf<String, LeaderboardEntry>()
  private val safeExitIds = mutableListOf<String>()
  private val shotExitIds = mutableListOf<String>()
  private var hasAwardedLiarsPlacementScores = false

  init {
    initialScoreboard.forEach { entry ->
      scoreboard[entry.playerId] = entry
    }
  }

  fun markConnected(playerId: String): Boolean {
    return players.find { it.id == playerId }?.let { player ->
      val statusChanged = player.connectionStatus != "connected"
      player.connectionStatus = "connected"
      player.lastSeen = System.currentTimeMillis()
      syncScoreboard(player, true, forcePresence = statusChanged)
      statusChanged
    } ?: false
  }

  fun markDisconnected(playerId: String): Boolean {
    return players.find { it.id == playerId }?.let { player ->
      val statusChanged = player.connectionStatus != "disconnected"
      player.connectionStatus = "disconnected"
      player.lastSeen = System.currentTimeMillis()
      syncScoreboard(player, false, forcePresence = true)
      statusChanged
    } ?: false
  }

  fun removeDisconnectedLobbyPlayerOrMarkDisconnected(playerId: String): Boolean {
    return markDisconnected(playerId)
  }

  fun cleanupInactiveLobbyPlayers(currentTime: Long): Boolean {
    if (gameStatus != "waiting") return false

    val removablePlayerIds = players
      .filter { player ->
        val inactiveSince = lobbyInactiveSince(player)
        val inactiveTimeout =
          if (player.connectionStatus == "disconnected") DISCONNECTED_LOBBY_PLAYER_TIMEOUT_MS
          else INACTIVE_LOBBY_PLAYER_TIMEOUT_MS
        inactiveSince != null && currentTime - inactiveSince >= inactiveTimeout
      }
      .map { it.id }

    removablePlayerIds.forEach { removePlayerFromRoom(it) }
    return removablePlayerIds.isNotEmpty()
  }

  private fun lobbyInactiveSince(player: Player): Long? {
    if (player.connectionStatus == "disconnected") return player.lastSeen
    if (player.isHost) return null
    if (!player.isReady && player.unreadySince > 0L) return player.unreadySince
    return null
  }

  fun hasPlayer(playerId: String): Boolean {
    return players.any { it.id == playerId }
  }

  fun disconnectedAutoActorId(): String? {
    if (gameStatus != "playing") return null

    val actorId = pendingPenaltyPlayerId ?: currentActorId()
    if (actorId.isNullOrBlank()) return null

    val player = players.find { it.id == actorId } ?: return null
    return actorId.takeIf { player.connectionStatus == "disconnected" }
  }

  fun autoOperateDisconnectedPlayer(playerId: String): Boolean {
    val player = players.find { it.id == playerId } ?: return false
    if (player.connectionStatus != "disconnected" || gameStatus != "playing") return false

    if (pendingPenaltyPlayerId == playerId && penaltyResult == null) {
      val fired = fireGun(playerId)
      if (!fired.ok) return false
      return autoResolvePenalty()
    }

    if ((pendingPenaltyPlayerId ?: currentActorId()) != playerId) return false

    return if (gameMode == "texasHoldem") {
      autoTakeTexasHoldemTurn(playerId)
    } else if (currentPlay != null) {
      autoRespondToLiarsBarPlay(playerId)
    } else {
      autoTakeLiarsBarTurn(playerId)
    }
  }

  fun clearServerState() {
    players.forEach { syncScoreboard(it, false) }
    players.clear()
    gameMode = "liarsBar"
    resetTransientState()
  }

  fun apply(action: String, playerId: String, payload: JSONObject): CommandResult {
    return when (action) {
      "joinGame" -> join(payload.optString("playerName", "").trim())
      "leaveGame" -> leave(playerId)
      "toggleReady" -> toggleReady(playerId, payload.optBoolean("isReady", false))
      "changeGameMode" -> if (canUseHostAction(playerId)) changeMode(playerId, payload.optString("gameMode", "liarsBar")) else unauthorized()
      "getGameState" -> CommandResult(true)
      "returnToRoom" -> if (canUseHostAction(playerId)) returnToRoom(playerId) else unauthorized()
      "startGame", "dealCards" -> if (canUseHostAction(playerId)) start(playerId) else unauthorized()
      "addBullets" -> addBullets(playerId, payload.optInt("count", 0))
      "refuseBullets" -> refuseBullets(playerId)
      "playCards" -> playCards(playerId, payload.optJSONArray("cardIds") ?: JSONArray(), payload.optInt("declaredCount", 0))
      "challenge" -> challenge(playerId)
      "trust" -> trust(playerId)
      "fireGun" -> fireGun(playerId)
      "resolvePenalty" -> CommandResult(true)
      "restartRound" -> if (canUseHostAction(playerId)) restartRound(playerId) else unauthorized()
      "discardTexasCard" -> discardTexasCard(playerId, payload.optString("cardId", ""))
      "exitTexasRound" -> exitTexasRound(playerId)
      else -> CommandResult(false, code = "INVALID_ACTION_STATE", message = "Unknown action: $action")
    }
  }

  fun toClientJson(viewerId: String?): JSONObject {
    players.forEach { syncScoreboard(it, it.connectionStatus == "connected") }

    return JSONObject()
      .put("players", JSONArray(players.map { it.json(viewerId) }))
      .put("gameStatus", gameStatus)
      .put("mainCard", mainCard)
      .put("currentPlayerIndex", currentPlayerIndex)
      .put("currentPlay", currentPlay?.json(mainCard, currentPlay?.isChallenged == true) ?: JSONObject.NULL)
      .put("playHistory", JSONArray(playHistory.map { it.json(mainCard, it.isChallenged) }))
      .put("round", round)
      .put("winner", JSONObject.NULL)
      .put("lastAddedBullets", lastAddedBullets)
      .put("pendingPenaltyPlayerId", pendingPenaltyPlayerId ?: JSONObject.NULL)
      .put("penaltyResult", penaltyResult ?: JSONObject.NULL)
      .put("penaltyAwardPlayerId", penaltyAwardPlayerId ?: JSONObject.NULL)
      .put("isSpinning", false)
      .put("gameMode", gameMode)
      .put("communityCards", JSONArray(communityCards.map { it.json() }))
      .put("texasHoldemRound", texasHoldemRound)
      .put("turnActorPlayerId", currentActorId() ?: JSONObject.NULL)
      .put("turnDeadlineAt", JSONObject.NULL)
      .put("turnTimeoutMs", 60000)
      .put("pendingTexasDiscardPlayerId", pendingTexasDiscardPlayerId ?: JSONObject.NULL)
      .put("texasStage", texasStage)
      .put("texasRoundResult", texasRoundResult ?: JSONObject.NULL)
      .put("texasPendingWinnerScore", texasPendingWinnerScore)
      .put("roundSettlement", roundSettlement ?: JSONObject.NULL)
      .put("scoreboard", JSONArray(scoreboard.values.sortedWith(compareByDescending<LeaderboardEntry> { it.score }.thenBy { it.name }).map { it.json() }))
  }

  fun toServerJson(): JSONObject {
    players.forEach { syncScoreboard(it, it.connectionStatus == "connected") }

    return JSONObject()
      .put("players", JSONArray(players.map { it.json(it.id) }))
      .put("gameStatus", gameStatus)
      .put("mainCard", mainCard)
      .put("currentPlayerIndex", currentPlayerIndex)
      .put("currentPlay", currentPlay?.json(mainCard, true) ?: JSONObject.NULL)
      .put("playHistory", JSONArray(playHistory.map { it.json(mainCard, true) }))
      .put("round", round)
      .put("winner", JSONObject.NULL)
      .put("lastAddedBullets", lastAddedBullets)
      .put("pendingPenaltyPlayerId", pendingPenaltyPlayerId ?: JSONObject.NULL)
      .put("penaltyResult", penaltyResult ?: JSONObject.NULL)
      .put("penaltyAwardPlayerId", penaltyAwardPlayerId ?: JSONObject.NULL)
      .put("isSpinning", false)
      .put("gameMode", gameMode)
      .put("communityCards", JSONArray(communityCards.map { it.json() }))
      .put("texasHoldemRound", texasHoldemRound)
      .put("turnActorPlayerId", currentActorId() ?: JSONObject.NULL)
      .put("turnDeadlineAt", JSONObject.NULL)
      .put("turnTimeoutMs", 60000)
      .put("pendingTexasDiscardPlayerId", pendingTexasDiscardPlayerId ?: JSONObject.NULL)
      .put("texasStage", texasStage)
      .put("texasRoundResult", texasRoundResult ?: JSONObject.NULL)
      .put("texasPendingWinnerScore", texasPendingWinnerScore)
      .put("roundSettlement", roundSettlement ?: JSONObject.NULL)
      .put("scoreboard", JSONArray(scoreboard.values.sortedWith(compareByDescending<LeaderboardEntry> { it.score }.thenBy { it.name }).map { it.json() }))
  }

  private fun join(playerName: String): CommandResult {
    val canonicalPlayerId = playerName.trim()
    if (canonicalPlayerId.isBlank()) return CommandResult(false, code = "INVALID_MESSAGE", message = "joinGame requires playerName")
    val currentHost = players.find { it.isHost }
    val joinsAsHost = currentHost == null
    players.find { it.id == canonicalPlayerId }?.let {
      it.name = canonicalPlayerId
      it.isHost = it.isHost || joinsAsHost
      it.connectionStatus = "connected"
      it.lastSeen = System.currentTimeMillis()
      it.unreadySince = if (it.isHost || it.isReady) 0L else System.currentTimeMillis()
      syncScoreboard(it, true)
      return CommandResult(true, changed = true)
    }
    if (players.size >= MAX_PLAYERS) return CommandResult(false, code = "ROOM_FULL", message = "Room is full")
    val restoredEntry = scoreboard[canonicalPlayerId]
    val joinsDuringGame = gameStatus == "playing"
    players += Player(
      id = canonicalPlayerId,
      name = canonicalPlayerId,
      isActive = !joinsDuringGame,
      score = restoredEntry?.score ?: 0,
      isHost = joinsAsHost,
      unreadySince = if (joinsAsHost) 0L else System.currentTimeMillis()
    )
    syncScoreboard(players.last(), true)
    return CommandResult(true, changed = true)
  }

  private fun leave(playerId: String): CommandResult {
    val player = players.find { it.id == playerId } ?: return CommandResult(true)
    if (gameStatus == "playing") {
      eliminateAndRemovePlayerFromActiveRound(player)
      val removed = removePlayerFromRoom(playerId)
      if (removed) {
        continueGameAfterPlayerLeave()
      }
      return CommandResult(true, changed = removed)
    }
    return CommandResult(true, changed = removePlayerFromRoom(playerId))
  }

  private fun eliminateAndRemovePlayerFromActiveRound(player: Player) {
    player.setEliminated()
    player.texasRoundState = "exited"
    player.texasLastAction = null
    player.isSurvivor = false

    val playerId = player.id
    if (pendingPenaltyPlayerId == playerId) {
      pendingPenaltyPlayerId = null
      penaltyResult = null
    }
    if (penaltyAwardPlayerId == playerId) {
      penaltyAwardPlayerId = null
    }
    if (pendingTexasDiscardPlayerId == playerId) {
      pendingTexasDiscardPlayerId = null
    }
    if (pendingTexasExitPlayerId == playerId) {
      pendingTexasExitPlayerId = null
    }
    if (turnActorPlayerId == playerId) {
      turnActorPlayerId = null
    }
    if (lastActivePlayerId == playerId) {
      lastActivePlayerId = null
    }
    if (roundStarterPlayerId == playerId) {
      roundStarterPlayerId = null
    }
    currentPlay?.takeIf { it.playerId == playerId }?.let {
      currentPlay = null
      turnActorPlayerId = null
    }
  }

  private fun continueGameAfterPlayerLeave() {
    if (gameStatus != "playing") return

    if (gameMode == "texasHoldem") {
      if (inHandPlayers().size <= 1) {
        settleTexasRound()
        return
      }
      if (pendingPenaltyPlayerId != null) return

      if (texasStage == "preDraw") {
        val nextDiscard = findNextIndex(currentPlayerIndex) { isInTexasHand(it) && !it.hasAddedBullets }
        if (nextDiscard != null) {
          prepareTexasPreDrawTurn(nextDiscard)
        } else {
          completeTexasPreDrawStage()
        }
        return
      }

      if (TEXAS_ACTION_STAGES.contains(texasStage)) {
        val nextActor = findNextIndex(currentPlayerIndex) { isInTexasHand(it) && !it.hasAddedBullets }
        if (nextActor != null) {
          currentPlayerIndex = nextActor
          return
        }
        when (texasStage) {
          "preFlop" -> startTexasPreDrawStage("flop")
          "flop" -> startTexasPreDrawStage("turn")
          "turn" -> startTexasPreDrawStage("river")
          else -> settleTexasRound()
        }
      }
      return
    }

    if (alivePlayers().size <= 1) {
      endLiarsRoundForSettlement()
      return
    }

    if (currentPlay != null && players.none { it.id == currentPlay?.playerId }) {
      currentPlay = null
      turnActorPlayerId = null
    }

    turnActorPlayerId = currentActorId()
  }

  private fun removePlayerFromRoom(playerId: String): Boolean {
    val index = players.indexOfFirst { it.id == playerId }
    if (index == -1) return false

    val wasHost = players[index].isHost
    syncScoreboard(players[index], false)
    players.removeAt(index)
    liarsTurnCyclePlayedPlayerIds.remove(playerId)
    completedLiarsPlayerIds.remove(playerId)
    currentPlayerIndex = currentPlayerIndex.coerceAtMost(max(0, players.lastIndex))
    if (wasHost) promoteHostIfNeeded()

    return true
  }

  private fun promoteHostIfNeeded() {
    if (players.any { it.isHost }) return
    val nextHost = players.firstOrNull { it.connectionStatus != "disconnected" } ?: players.firstOrNull() ?: return
    nextHost.isHost = true
    nextHost.unreadySince = 0L
  }

  private fun toggleReady(playerId: String, ready: Boolean): CommandResult {
    val player = players.find { it.id == playerId } ?: return notFound()
    if (gameStatus != "waiting") return CommandResult(false, message = "Ready state can only be changed in the room")
    player.isReady = ready
    player.unreadySince = if (player.isHost || ready) 0L else System.currentTimeMillis()
    return CommandResult(true, changed = true)
  }

  private fun changeMode(playerId: String, mode: String): CommandResult {
    if (!isHost(playerId)) return unauthorized()
    if (gameStatus != "waiting") return CommandResult(false, message = "Game mode can only be changed in the room")
    gameMode = if (mode == "texasHoldem") "texasHoldem" else "liarsBar"
    return CommandResult(true, changed = true)
  }

  private fun returnToRoom(playerId: String): CommandResult {
    if (!isHost(playerId)) return unauthorized()
    resetRoom()
    return CommandResult(true, changed = true)
  }

  private fun start(playerId: String): CommandResult {
    if (!isHost(playerId)) return unauthorized()
    if (gameStatus != "waiting") return CommandResult(false, message = "Game can only start from the room")
    if (players.size < 2) return CommandResult(false, message = "At least 2 players are required")
    if (!players.filter { !it.isHost }.all { it.isReady }) {
      return CommandResult(false, message = "All guest players must be ready")
    }
    gameStatus = "playing"
    lastActivePlayerId = null
    roundStarterPlayerId = null
    players.forEach { it.setPlaying(resetBullets = true) }
    if (gameMode == "texasHoldem") startTexasRound() else startNewRound()
    return CommandResult(true, changed = true)
  }

  private fun addBullets(playerId: String, count: Int): CommandResult {
    if (gameMode == "texasHoldem") return addTexasBullets(playerId, count)
    if (gameStatus != "playing" || pendingPenaltyPlayerId != null) return CommandResult(false, message = "Cannot add bullets")
    val player = players.find { it.id == playerId } ?: return notFound()
    if (currentActorId() != playerId || player.hasAddedBullets) return CommandResult(false, message = "Cannot add bullets")
    val minAdd = max(1, lastAddedBullets)
    if (count < minAdd) return CommandResult(false, message = "Invalid bullet count")
    player.bulletCount += count
    player.hasAddedBullets = true
    lastAddedBullets = count
    return CommandResult(true, changed = true)
  }

  private fun autoAddMinimumBulletsOrRefuse(playerId: String): Boolean {
    val player = players.find { it.id == playerId } ?: return false
    if (player.hasAddedBullets) return true

    val count = max(1, lastAddedBullets)
    val addResult = addBullets(playerId, count)
    if (addResult.changed) {
      return true
    }

    val fallback = if (gameMode == "texasHoldem") exitTexasRound(playerId) else refuseBullets(playerId)
    return fallback.changed
  }

  private fun refuseBullets(playerId: String): CommandResult {
    if (gameMode == "texasHoldem") return exitTexasRound(playerId)
    if (gameStatus != "playing" || pendingPenaltyPlayerId != null || currentActorId() != playerId) {
      return CommandResult(false, message = "Cannot refuse bullets")
    }
    val player = players.find { it.id == playerId } ?: return notFound()
    if (player.hasAddedBullets) return CommandResult(false, message = "Cannot refuse bullets")
    pendingPenaltyPlayerId = playerId
    penaltyAwardPlayerId = null
    turnActorPlayerId = null
    rememberLastActivePlayer(playerId)
    return CommandResult(true, changed = true)
  }

  private fun playCards(playerId: String, cardIds: JSONArray, declaredCount: Int): CommandResult {
    val player = players.find { it.id == playerId } ?: return notFound()
    if (gameStatus != "playing" || currentPlay != null || currentActorId() != playerId || !player.hasAddedBullets) {
      return CommandResult(false, message = "Cannot play cards")
    }
    if (declaredCount !in 1..3 || cardIds.length() !in 1..3) return CommandResult(false, code = "INVALID_MESSAGE", message = "Invalid card selection")
    val ids = (0 until cardIds.length()).map { cardIds.optString(it) }.toSet()
    val selected = player.cards.filter { ids.contains(it.id) }
    if (selected.size != ids.size) return CommandResult(false, message = "Selected cards not found")
    player.cards.removeAll { ids.contains(it.id) }
    currentPlay = PlayRecord(playerId, selected, declaredCount)
    rememberLiarsTurnCyclePlayedPlayer(playerId)
    val responderIndex = randomUnplayedLiarsActiveIndex(excludePlayerId = playerId)
    turnActorPlayerId = responderIndex?.let { players[it].id }
    responderIndex?.let { players[it].hasAddedBullets = false }
    rememberLastActivePlayer(playerId)
    return CommandResult(true, changed = true)
  }

  private fun challenge(playerId: String): CommandResult {
    val play = currentPlay ?: return CommandResult(false, message = "Cannot challenge")
    val challenger = players.find { it.id == playerId } ?: return notFound()
    if (currentActorId() != playerId || !challenger.hasAddedBullets) return CommandResult(false, message = "Cannot challenge")
    val actual = play.cards.count { it.rank == mainCard || it.rank == "Joker" }
    val success = actual < play.declaredCount
    play.isChallenged = true
    play.challengeResult = success
    pendingPenaltyPlayerId = if (success) play.playerId else playerId
    penaltyAwardPlayerId = playerId
    turnActorPlayerId = null
    playHistory += play.copy(cards = play.cards.toList(), isChallenged = true, challengeResult = success)
    rememberLastActivePlayer(playerId)
    return CommandResult(true, changed = true)
  }

  private fun trust(playerId: String): CommandResult {
    val play = currentPlay ?: return CommandResult(false, message = "Cannot trust")
    val truster = players.find { it.id == playerId } ?: return notFound()
    if (currentActorId() != playerId || !truster.hasAddedBullets) return CommandResult(false, message = "Cannot trust")
    playHistory += play
    val completed = registerCompletedLiarsPlayer(play.playerId)

    currentPlay = null
    turnActorPlayerId = null
    if (completed && endLiarsRoundForSettlementIfReady()) {
      rememberLastActivePlayer(playerId)
      return CommandResult(true, changed = true)
    }
    if (!completed || (!truster.isEliminated && truster.isActive)) {
      currentPlayerIndex = players.indexOfFirst { it.id == playerId }.takeIf { it >= 0 } ?: currentPlayerIndex
    }
    rememberLastActivePlayer(playerId)
    return CommandResult(true, changed = true)
  }

  private fun registerCompletedLiarsPlayer(playerId: String?): Boolean {
    if (playerId.isNullOrBlank()) return false

    val completedPlayer = players.find { it.id == playerId } ?: return false
    if (completedPlayer.cards.isNotEmpty() || completedPlayer.isEliminated || !completedPlayer.isActive) {
      return false
    }

    if (!completedLiarsPlayerIds.contains(completedPlayer.id)) {
      completedLiarsPlayerIds += completedPlayer.id
    }
    completedPlayer.isActive = false
    completedPlayer.gameState = "waiting"
    completedPlayer.hasAddedBullets = false
    liarsTurnCyclePlayedPlayerIds.remove(completedPlayer.id)
    return true
  }

  private fun autoRespondToLiarsBarPlay(playerId: String): Boolean {
    val player = players.find { it.id == playerId } ?: return false

    if (!player.hasAddedBullets) {
      val prepared = autoAddMinimumBulletsOrRefuse(playerId)
      if (!prepared) return false
      if (pendingPenaltyPlayerId == playerId) return true
    }

    return trust(playerId).changed
  }

  private fun autoTakeLiarsBarTurn(playerId: String): Boolean {
    val player = players.find { it.id == playerId } ?: return false

    if (!player.hasAddedBullets) {
      val prepared = autoAddMinimumBulletsOrRefuse(playerId)
      if (!prepared) return false
      if (pendingPenaltyPlayerId == playerId) return true
    }

    val nextCard = player.cards.firstOrNull() ?: return false
    return playCards(playerId, JSONArray().put(nextCard.id), 1).changed
  }

  private fun awardLiarsPlacementScores(winnerId: String) {
    if (hasAwardedLiarsPlacementScores) return

    val placementOrder = liarsPlacementOrder(winnerId)
    val participantCount = roundScoreBaseline.size
    placementOrder.forEachIndexed { index, placementPlayerId ->
      players.find { it.id == placementPlayerId }?.let { player ->
        player.score += participantCount - index
        syncScoreboard(player, true)
      }
    }
    hasAwardedLiarsPlacementScores = true
  }

  private fun liarsPlacementOrder(winnerId: String): List<String> {
    val participantIds = roundScoreBaseline.keys.toList()
    val participantSet = participantIds.toSet()
    val completedIds = completedLiarsPlayerIds.filter { participantSet.contains(it) }
    val winnerIds =
      if (completedIds.isNotEmpty()) completedIds
      else if (participantSet.contains(winnerId)) listOf(winnerId)
      else emptyList()
    val placedIds = winnerIds.toSet()
    val remainingIds = participantIds
      .filter { playerId ->
        val player = players.find { it.id == playerId }
        !placedIds.contains(playerId) && player?.isEliminated != true && player?.isActive == true
      }
      .sortedWith { leftId, rightId ->
        val leftCards = players.find { it.id == leftId }?.cards?.size ?: Int.MAX_VALUE
        val rightCards = players.find { it.id == rightId }?.cards?.size ?: Int.MAX_VALUE
        if (leftCards != rightCards) {
          leftCards - rightCards
        } else {
          participantIds.indexOf(leftId) - participantIds.indexOf(rightId)
        }
      }

    return winnerIds + remainingIds
  }

  private fun fireGun(playerId: String): CommandResult {
    if (gameMode == "texasHoldem") return fireTexasGun(playerId)
    if (pendingPenaltyPlayerId != playerId || penaltyResult != null) return CommandResult(false, message = "Cannot fire gun")
    val victim = players.find { it.id == playerId } ?: return notFound()
    val shot = Random.nextInt(victim.totalChambers.coerceAtLeast(1)) < victim.bulletCount
    if (shot) {
      victim.setEliminated()
      victim.score -= 1
    } else {
      victim.hasAddedBullets = false
      victim.isActive = false
      victim.gameState = "waiting"
      victim.isSurvivor = true
    }
    val result = JSONObject().put("shot", shot).put("victimId", playerId)
    penaltyResult = result
    return CommandResult(
      true,
      changed = true,
      data = JSONObject().put("penaltyResult", JSONObject(result.toString()))
    )
  }

  fun autoResolvePenalty(): Boolean {
    return if (gameMode == "texasHoldem") {
      resolveTexasPenaltyInternal()
    } else {
      resolveLiarsPenaltyInternal()
    }
  }

  private fun resolveLiarsPenaltyInternal(): Boolean {
    if (penaltyResult == null) return false
    val shouldContinue = gameStatus == "playing"
    val preservePreparedPlayerId = penaltyAwardPlayerId
    clearPenaltyContext()
    if (shouldContinue) {
      continueAfterLiarsPenalty(preservePreparedPlayerId)
    }
    return true
  }

  private fun clearPenaltyContext() {
    pendingPenaltyPlayerId = null
    penaltyAwardPlayerId = null
    penaltyResult = null
    lastActivePlayerId = null
  }

  private fun continueAfterLiarsPenalty(preservePreparedPlayerId: String?) {
    val completedPlayerId = currentPlay
      ?.takeIf { it.challengeResult == false }
      ?.playerId

    currentPlay = null
    turnActorPlayerId = null
    registerCompletedLiarsPlayer(completedPlayerId)

    if (alivePlayers().size <= 1) {
      endLiarsRoundForSettlement()
      return
    }

    val preparedPlayerIndex = preservePreparedPlayerId?.let { playerId ->
      players.indexOfFirst { player ->
        player.id == playerId && !player.isEliminated && player.isActive
      }.takeIf { it >= 0 }
    }
    val nextIndex = preparedPlayerIndex ?: randomUnplayedLiarsActiveIndex()
    if (nextIndex != null) {
      currentPlayerIndex = nextIndex
      if (players[currentPlayerIndex].id != preservePreparedPlayerId) {
        players[currentPlayerIndex].hasAddedBullets = false
      }
    }
  }

  private fun endLiarsRoundForSettlementIfReady(): Boolean {
    if (alivePlayers().size > 1) return false
    endLiarsRoundForSettlement()
    return true
  }

  private fun endLiarsRoundForSettlement() {
    checkGameEnd()
    val placementWinnerId = completedLiarsPlayerIds.firstOrNull() ?: alivePlayers().singleOrNull()?.id
    placementWinnerId?.let { winnerId -> awardLiarsPlacementScores(winnerId) }
    roundSettlement = createLiarsSettlement()
    gameStatus = "ended"
    currentPlay = null
    turnActorPlayerId = null
    liarsTurnCyclePlayedPlayerIds.clear()
    playHistory.clear()
    players.forEach { player ->
      if (isSpectator(player)) {
        player.cards.clear()
        player.hasAddedBullets = false
        player.isSurvivor = false
        return@forEach
      }
      if (player.isEliminated) player.setEliminated() else player.setPlaying()
    }
  }

  private fun restartRound(playerId: String): CommandResult {
    if (!isHost(playerId)) return unauthorized()
    if (gameStatus != "ended" || players.size < 2) return CommandResult(false, message = "Cannot restart round")
    gameStatus = "playing"
    players.forEach {
      if (isSpectator(it)) {
        it.cards.clear()
        it.hasAddedBullets = false
        it.isSurvivor = false
        it.texasRoundState = "waiting"
        it.texasLastAction = null
      } else {
        it.setPlaying(resetBullets = true)
        it.texasRoundState = "waiting"
        it.texasLastAction = null
      }
    }
    if (gameMode == "texasHoldem") startTexasRound() else startNewRound()
    return CommandResult(true, changed = true)
  }

  private fun resetRoom() {
    gameStatus = "waiting"
    resetTransientState()

    players.removeAll { player ->
      val shouldRemove = player.connectionStatus == "disconnected"
      if (shouldRemove) {
        syncScoreboard(player, false)
      }
      shouldRemove
    }

    players.forEach {
      it.resetForRoom()
      syncScoreboard(it, true)
    }
  }

  private fun resetTransientState() {
    gameStatus = "waiting"
    currentPlayerIndex = 0
    turnActorPlayerId = null
    currentPlay = null
    playHistory.clear()
    liarsTurnCyclePlayedPlayerIds.clear()
    completedLiarsPlayerIds.clear()
    round = 0
    roundStarterPlayerId = null
    lastAddedBullets = 0
    pendingPenaltyPlayerId = null
    penaltyAwardPlayerId = null
    penaltyResult = null
    pendingTexasDiscardPlayerId = null
    pendingTexasActionStageAfterPreDraw = null
    pendingTexasExitPlayerId = null
    texasStage = "idle"
    texasHoldemRound = 0
    texasPendingWinnerScore = 0
    texasRoundResult = null
    roundSettlement = null
    lastActivePlayerId = null
    roundScoreBaseline.clear()
    liarsInitialHands.clear()
    safeExitIds.clear()
    shotExitIds.clear()
    communityCards.clear()
    hasAwardedLiarsPlacementScores = false
  }

  private fun startNewRound() {
    round += 1
    currentPlay = null
    turnActorPlayerId = null
    playHistory.clear()
    liarsTurnCyclePlayedPlayerIds.clear()
    completedLiarsPlayerIds.clear()
    lastAddedBullets = 0
    pendingPenaltyPlayerId = null
    penaltyAwardPlayerId = null
    penaltyResult = null
    roundSettlement = null
    hasAwardedLiarsPlacementScores = false
    liarsInitialHands.clear()
    mainCard = listOf("Q", "K", "A").random()
    alivePlayers().forEach { it.setPlaying(resetBullets = true) }
    alivePlayers().forEach { player ->
      player.bullets = ROUND_INITIAL_BULLETS
      player.initialBullets = ROUND_INITIAL_BULLETS
      player.bulletCount = ROUND_INITIAL_BULLETS
    }
    captureRoundScoreBaseline(alivePlayers().map { it.id })
    buildDeck()
    alivePlayers().forEach { player ->
      player.cards.clear()
      repeat(5) {
        if (deck.isNotEmpty()) player.cards += deck.removeAt(Random.nextInt(deck.size))
      }
    }
    captureLiarsInitialHands()
    currentPlayerIndex = resolveLiarsRoundStarterIndex().coerceAtLeast(0)
    if (players.isNotEmpty()) {
      roundStarterPlayerId = players[currentPlayerIndex].id
      players[currentPlayerIndex].hasAddedBullets = false
    }
  }

  private fun startTexasRound() {
    round += 1
    currentPlay = null
    turnActorPlayerId = null
    playHistory.clear()
    liarsTurnCyclePlayedPlayerIds.clear()
    completedLiarsPlayerIds.clear()
    lastAddedBullets = 0
    pendingPenaltyPlayerId = null
    penaltyAwardPlayerId = null
    penaltyResult = null
    pendingTexasExitPlayerId = null
    texasRoundResult = null
    roundSettlement = null
    texasPendingWinnerScore = 0
    roundScoreBaseline.clear()
    safeExitIds.clear()
    shotExitIds.clear()
    communityCards.clear()
    texasStage = "preDraw"
    texasHoldemRound = 0
    pendingTexasActionStageAfterPreDraw = null

    players.forEach { player ->
      player.cards.clear()
      player.hasAddedBullets = false
      player.isSurvivor = false
      player.texasLastAction = null
      if (isSpectator(player)) {
        player.texasRoundState = "waiting"
      } else if (!player.isEliminated) {
        player.setPlaying(resetBullets = true)
        player.bullets = ROUND_INITIAL_BULLETS
        player.initialBullets = ROUND_INITIAL_BULLETS
        player.bulletCount = ROUND_INITIAL_BULLETS
        player.texasRoundState = "inHand"
      } else {
        player.setEliminated()
        player.texasRoundState = "waiting"
      }
    }

    buildTexasDeck()
    inHandPlayers().forEach { player ->
      repeat(2) {
        if (deck.isNotEmpty()) player.cards += deck.removeAt(0)
      }
    }
    captureRoundScoreBaseline(inHandPlayers().map { it.id })

    val starter = resolveTexasRoundStarterIndex()
    if (starter == -1) {
      settleTexasRound()
      return
    }

    currentPlayerIndex = starter
    roundStarterPlayerId = players[starter].id
    startTexasPreDrawStage("flop")
  }

  private fun discardTexasCard(playerId: String, cardId: String): CommandResult {
    if (gameMode != "texasHoldem" || gameStatus != "playing" || texasStage != "preDraw") {
      return CommandResult(false, message = "Cannot discard Texas card")
    }
    if (pendingTexasDiscardPlayerId != playerId) return CommandResult(false, message = "Cannot discard Texas card")
    val player = players.find { it.id == playerId } ?: return notFound()
    if (!isInTexasHand(player) || player.cards.size != 3) return CommandResult(false, message = "Cannot discard Texas card")
    val removed = player.cards.removeAll { it.id == cardId }
    if (!removed) return CommandResult(false, message = "Card not found")
    currentPlayerIndex = players.indexOf(player)

    return CommandResult(true, changed = true)
  }

  private fun addTexasBullets(playerId: String, count: Int): CommandResult {
    if (!canActTexas(playerId)) return CommandResult(false, message = "Cannot add bullets")
    val player = players.find { it.id == playerId } ?: return notFound()
    if (player.hasAddedBullets) return CommandResult(false, message = "Cannot add bullets")
    val minAdd = max(1, lastAddedBullets)
    if (count < minAdd) return CommandResult(false, message = "Invalid bullet count")
    player.bulletCount += count
    player.hasAddedBullets = true
    player.texasLastAction = "addBullets"
    lastAddedBullets = count
    advanceTexasAfterAction()
    return CommandResult(true, changed = true)
  }

  private fun exitTexasRound(playerId: String): CommandResult {
    if (!canActTexas(playerId)) return CommandResult(false, message = "Cannot exit Texas round")
    val player = players.find { it.id == playerId } ?: return notFound()
    if (!isInTexasHand(player)) return CommandResult(false, message = "Cannot exit Texas round")
    pendingPenaltyPlayerId = playerId
    pendingTexasExitPlayerId = playerId
    penaltyAwardPlayerId = null
    return CommandResult(true, changed = true)
  }

  private fun autoTakeTexasHoldemTurn(playerId: String): Boolean {
    val player = players.find { it.id == playerId } ?: return false

    if (pendingTexasDiscardPlayerId == playerId && player.cards.size > 2) {
      val discardCard = player.cards.firstOrNull() ?: return false
      return discardTexasCard(playerId, discardCard.id).changed
    }

    val prepared = autoAddMinimumBulletsOrRefuse(playerId)
    if (!prepared) return false
    if (pendingPenaltyPlayerId == playerId) return true

    return true
  }

  private fun fireTexasGun(playerId: String): CommandResult {
    if (pendingPenaltyPlayerId != playerId || pendingTexasExitPlayerId != playerId || penaltyResult != null) {
      return CommandResult(false, message = "Cannot fire gun")
    }
    val victim = players.find { it.id == playerId } ?: return notFound()
    val shot = Random.nextInt(victim.totalChambers.coerceAtLeast(1)) < victim.bulletCount
    victim.texasRoundState = "exited"
    victim.texasLastAction = if (shot) "exitShot" else "exitSafe"
    if (shot) {
      victim.setEliminated()
      victim.texasRoundState = "exited"
      victim.score -= 1
      texasPendingWinnerScore += 1
      shotExitIds += victim.id
    } else {
      victim.hasAddedBullets = false
      victim.isSurvivor = true
      safeExitIds += victim.id
    }
    val result = JSONObject().put("shot", shot).put("victimId", playerId)
    penaltyResult = result
    return CommandResult(
      true,
      changed = true,
      data = JSONObject().put("penaltyResult", JSONObject(result.toString()))
    )
  }

  private fun resolveTexasPenaltyInternal(): Boolean {
    if (penaltyResult == null) return false
    pendingPenaltyPlayerId = null
    pendingTexasExitPlayerId = null
    penaltyResult = null
    penaltyAwardPlayerId = null

    if (inHandPlayers().size <= 1) {
      settleTexasRound()
    } else {
      advanceTexasAfterAction()
    }

    return true
  }

  private fun startTexasActionStage(stage: String) {
    texasStage = stage
    pendingTexasActionStageAfterPreDraw = null
    texasHoldemRound = when (stage) {
      "preFlop" -> 1
      "flop" -> 2
      "turn" -> 3
      "river" -> 4
      else -> 0
    }
    lastAddedBullets = 0
    revealCommunityCards(stage)
    inHandPlayers().forEach {
      it.hasAddedBullets = false
      it.isSurvivor = false
    }
    val actor = resolveTexasActionStageStarterIndex()
    if (actor == null) settleTexasRound() else currentPlayerIndex = actor
  }

  private fun startTexasPreDrawStage(nextActionStage: String) {
    texasStage = "preDraw"
    texasHoldemRound = 0
    pendingTexasActionStageAfterPreDraw = nextActionStage
    pendingTexasDiscardPlayerId = null
    turnActorPlayerId = null
    lastAddedBullets = 0

    inHandPlayers().forEach { player ->
      player.hasAddedBullets = false
      player.isSurvivor = false
    }

    val starter = resolveCurrentRoundStarterIndex { player ->
      isInTexasHand(player) && !player.hasAddedBullets
    }

    if (starter == null) {
      startTexasActionStage(nextActionStage)
      return
    }

    prepareTexasPreDrawTurn(starter)
  }

  private fun advanceTexasAfterAction() {
    if (pendingPenaltyPlayerId != null) return
    if (inHandPlayers().size <= 1) {
      settleTexasRound()
      return
    }
    if (texasStage == "preDraw") {
      val nextDiscard = findNextIndex(currentPlayerIndex + 1) { isInTexasHand(it) && !it.hasAddedBullets }
      if (nextDiscard != null) {
        prepareTexasPreDrawTurn(nextDiscard)
      } else {
        completeTexasPreDrawStage()
      }
      return
    }
    val next = findNextIndex(currentPlayerIndex + 1) { isInTexasHand(it) && !it.hasAddedBullets }
    if (next != null) {
      currentPlayerIndex = next
      return
    }
    when (texasStage) {
      "preFlop" -> startTexasPreDrawStage("flop")
      "flop" -> startTexasPreDrawStage("turn")
      "turn" -> startTexasPreDrawStage("river")
      else -> settleTexasRound()
    }
  }

  private fun prepareTexasPreDrawTurn(playerIndex: Int) {
    val player = players.getOrNull(playerIndex) ?: return
    if (!isInTexasHand(player)) return

    if (player.cards.size <= 2 && deck.isNotEmpty()) {
      player.cards += deck.removeAt(0)
    }

    currentPlayerIndex = playerIndex
    pendingTexasDiscardPlayerId = player.id
  }

  private fun completeTexasPreDrawStage() {
    val completedStage = pendingTexasActionStageAfterPreDraw ?: "flop"
    pendingTexasDiscardPlayerId = null
    pendingTexasActionStageAfterPreDraw = null

    revealCommunityCards(completedStage)

    when (completedStage) {
      "flop" -> startTexasPreDrawStage("turn")
      "turn" -> startTexasPreDrawStage("river")
      else -> settleTexasRound()
    }
  }

  private fun settleTexasRound() {
    val participants = inHandPlayers()
    val evaluated = if (participants.size > 1 || communityCards.size >= 3) {
      participants.map { player -> player to evaluateBestTexasHand(player.cards + communityCards) }
    } else {
      emptyList()
    }
    val bestEvaluation = evaluated
      .map { it.second }
      .maxWithOrNull { left, right -> compareTexasEvaluations(left, right) }
    val winner = bestEvaluation?.let { best ->
      evaluated.firstOrNull { compareTexasEvaluations(it.second, best) == 0 }?.first
    } ?: participants.firstOrNull()
    val tiedBestIds = bestEvaluation?.let { best ->
      evaluated
        .filter { compareTexasEvaluations(it.second, best) == 0 }
        .map { it.first.id }
    } ?: emptyList()
    val winnerIds = if (winner != null) listOf(winner.id) else emptyList()
    val loserIds = participants.filter { winner == null || it.id != winner.id }.map { it.id }
    val winnerGain = loserIds.size + texasPendingWinnerScore
    if (winner != null) winner.score += winnerGain
    loserIds.forEach { loserId -> players.find { it.id == loserId }?.score = (players.find { it.id == loserId }?.score ?: 0) - 1 }
    gameStatus = "ended"
    texasStage = "settlement"
    texasHoldemRound = 6
    pendingTexasDiscardPlayerId = null
    pendingPenaltyPlayerId = null
    pendingTexasExitPlayerId = null
    texasRoundResult = JSONObject()
      .put("winnerIds", JSONArray(winnerIds))
      .put("tiedBestIds", JSONArray(tiedBestIds))
      .put("participantIds", JSONArray(participants.map { it.id }))
      .put("loserIds", JSONArray(loserIds))
      .put("safeExitIds", JSONArray(safeExitIds.distinct()))
      .put("shotExitIds", JSONArray(shotExitIds.distinct()))
      .put("winnerScoreGain", winnerGain)
    roundSettlement = createTexasSettlement(
      winnerIds = winnerIds,
      tiedBestIds = tiedBestIds,
      participantIds = participants.map { it.id },
      loserIds = loserIds,
      safeExitIds = safeExitIds.distinct(),
      shotExitIds = shotExitIds.distinct(),
      evaluated = evaluated
    )
  }

  private fun syncScoreboard(player: Player, isActive: Boolean = true, forcePresence: Boolean = false) {
    val existing = scoreboard[player.id]
    val nextLastSeen = if (
      forcePresence ||
      existing == null ||
      existing.name != player.name ||
      existing.score != player.score ||
      existing.isActive != isActive ||
      player.lastSeen - existing.lastSeen >= PRESENCE_PERSIST_INTERVAL_MS
    ) {
      player.lastSeen
    } else {
      existing.lastSeen
    }
    val nextEntry = LeaderboardEntry(
      playerId = player.id,
      name = player.name,
      score = player.score,
      isActive = isActive,
      lastSeen = nextLastSeen
    )
    if (scoreboard[player.id] == nextEntry) return

    scoreboard[player.id] = nextEntry
    onScoreboardChanged?.invoke(scoreboard.values.toList())
  }

  private fun captureRoundScoreBaseline(playerIds: List<String>) {
    roundScoreBaseline.clear()
    playerIds.forEach { playerId ->
      players.find { it.id == playerId }?.let { player ->
        roundScoreBaseline[player.id] = player.score
      }
    }
  }

  private fun scoreDeltasJson(playerIds: List<String>): JSONArray {
    return JSONArray(playerIds.mapNotNull { playerId ->
      val player = players.find { it.id == playerId } ?: return@mapNotNull null
      val baseline = roundScoreBaseline[playerId] ?: player.score
      JSONObject()
        .put("playerId", playerId)
        .put("delta", player.score - baseline)
        .put("totalScore", player.score)
    })
  }

  private fun cardsJson(cards: List<Card>): JSONArray {
    return JSONArray(cards.map { it.json() })
  }

  private fun captureLiarsInitialHands() {
    liarsInitialHands.clear()
    alivePlayers().forEach { player ->
      liarsInitialHands[player.id] = player.cards.toList()
    }
  }

  private fun createLiarsSettlement(): JSONObject {
    val playerIds = roundScoreBaseline.keys.toList()
    val placementOrder = liarsPlacementOrder(alivePlayers().firstOrNull()?.id.orEmpty())
    val winnerIds = placementOrder.firstOrNull()?.let { listOf(it) } ?: emptyList()
    return JSONObject()
      .put("id", "$gameMode-$round")
      .put("gameMode", gameMode)
      .put("round", round)
      .put("scoreDeltas", scoreDeltasJson(playerIds))
      .put("hands", JSONArray(playerIds.map { playerId ->
        JSONObject()
          .put("playerId", playerId)
          .put("cards", cardsJson(liarsInitialHands[playerId] ?: emptyList()))
          .put("source", "initial")
          .put("isWinner", winnerIds.contains(playerId))
      }))
      .put("winnerIds", JSONArray(winnerIds))
  }

  private fun createTexasSettlement(
    winnerIds: List<String>,
    tiedBestIds: List<String>,
    participantIds: List<String>,
    loserIds: List<String>,
    safeExitIds: List<String>,
    shotExitIds: List<String>,
    evaluated: List<Pair<Player, TexasEvaluation>>
  ): JSONObject {
    val playerIds = roundScoreBaseline.keys.toList()
    val evaluationByPlayerId = evaluated.associate { it.first.id to it.second }
    val ranked = evaluated.sortedWith { left, right -> compareTexasEvaluations(right.second, left.second) }
    val compareRankByPlayerId = mutableMapOf<String, Int>()

    ranked.forEachIndexed { index, hand ->
      val previous = ranked.getOrNull(index - 1)
      val rank = if (previous != null && compareTexasEvaluations(hand.second, previous.second) == 0) {
        compareRankByPlayerId[previous.first.id] ?: index
      } else {
        index + 1
      }
      compareRankByPlayerId[hand.first.id] = rank
    }

    if (participantIds.size == 1) {
      compareRankByPlayerId[participantIds[0]] = 1
    }

    return JSONObject()
      .put("id", "$gameMode-$round")
      .put("gameMode", gameMode)
      .put("round", round)
      .put("scoreDeltas", scoreDeltasJson(playerIds))
      .put("hands", JSONArray(playerIds.map { playerId ->
        val player = players.find { it.id == playerId }
        val evaluation = evaluationByPlayerId[playerId]
        JSONObject()
          .put("playerId", playerId)
          .put("cards", cardsJson(player?.cards ?: emptyList()))
          .put("source", "final")
          .put("isParticipant", participantIds.contains(playerId))
          .put("isWinner", winnerIds.contains(playerId))
          .put("isTiedBest", (if (tiedBestIds.isNotEmpty()) tiedBestIds else winnerIds).contains(playerId))
          .put("compareRank", compareRankByPlayerId[playerId] ?: JSONObject.NULL)
          .put("texasRoundState", player?.texasRoundState ?: JSONObject.NULL)
          .put("texasLastAction", player?.texasLastAction ?: JSONObject.NULL)
          .put("handCategory", evaluation?.let { texasCategoryKey(it.category) } ?: JSONObject.NULL)
          .put("handCategoryRank", evaluation?.category ?: JSONObject.NULL)
          .put("handRanks", evaluation?.let { JSONArray(it.ranks) } ?: JSONObject.NULL)
          .put("bestCards", evaluation?.let { cardsJson(it.cards) } ?: JSONObject.NULL)
      }))
      .put("winnerIds", JSONArray(winnerIds))
      .put("loserIds", JSONArray(loserIds))
      .put("safeExitIds", JSONArray(safeExitIds))
      .put("shotExitIds", JSONArray(shotExitIds))
      .put("communityCards", cardsJson(communityCards))
  }

  private fun texasCategoryKey(category: Int): String {
    return when (category) {
      9 -> "straightFlush"
      8 -> "fourOfAKind"
      7 -> "fullHouse"
      6 -> "flush"
      5 -> "straight"
      4 -> "threeOfAKind"
      3 -> "twoPair"
      2 -> "onePair"
      else -> "highCard"
    }
  }

  private fun revealCommunityCards(stage: String) {
    val target = when (stage) {
      "flop" -> 3
      "turn" -> 4
      "river" -> 5
      else -> communityCards.size
    }
    while (communityCards.size < target && deck.isNotEmpty()) {
      communityCards += deck.removeAt(0)
    }
  }

  private fun buildTexasDeck() {
    deck.clear()
    val suits = listOf("spades", "hearts", "diamonds", "clubs")
    val ranks = listOf("2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A")
    suits.forEach { suit ->
      ranks.forEach { rank -> deck += Card("$suit-$rank", rank, suit) }
    }
    deck.shuffle()
  }

  private fun evaluateBestTexasHand(cards: List<Card>): TexasEvaluation {
    if (cards.size < 5) {
      return TexasEvaluation(1, cards.map { rankValue(it.rank) }.sortedDescending(), cards)
    }

    var best: TexasEvaluation? = null
    for (a in 0 until cards.size - 4) {
      for (b in a + 1 until cards.size - 3) {
        for (c in b + 1 until cards.size - 2) {
          for (d in c + 1 until cards.size - 1) {
            for (e in d + 1 until cards.size) {
              val evaluation = evaluateFiveCardTexasHand(listOf(cards[a], cards[b], cards[c], cards[d], cards[e]))
              if (best == null || compareTexasEvaluations(evaluation, best) > 0) {
                best = evaluation
              }
            }
          }
        }
      }
    }

    return best ?: TexasEvaluation(1, emptyList(), emptyList())
  }

  private fun evaluateFiveCardTexasHand(cards: List<Card>): TexasEvaluation {
    val values = cards.map { rankValue(it.rank) }.sortedDescending()
    val isFlush = cards.mapNotNull { it.suit }.toSet().size == 1
    val straightHigh = straightHighCard(values)
    val groups = values
      .groupingBy { it }
      .eachCount()
      .map { (rank, count) -> rank to count }
      .sortedWith(compareByDescending<Pair<Int, Int>> { it.second }.thenByDescending { it.first })

    if (isFlush && straightHigh != null) {
      return TexasEvaluation(9, listOf(straightHigh), cards)
    }

    if (groups.firstOrNull()?.second == 4) {
      val quad = groups[0].first
      val kicker = values.first { it != quad }
      return TexasEvaluation(8, listOf(quad, kicker), cards)
    }

    if (groups.firstOrNull()?.second == 3 && groups.getOrNull(1)?.second == 2) {
      return TexasEvaluation(7, listOf(groups[0].first, groups[1].first), cards)
    }

    if (isFlush) {
      return TexasEvaluation(6, values, cards)
    }

    if (straightHigh != null) {
      return TexasEvaluation(5, listOf(straightHigh), cards)
    }

    if (groups.firstOrNull()?.second == 3) {
      val trips = groups[0].first
      val kickers = values.filter { it != trips }.sortedDescending()
      return TexasEvaluation(4, listOf(trips) + kickers, cards)
    }

    val pairs = groups.filter { it.second == 2 }.map { it.first }.sortedDescending()
    if (pairs.size >= 2) {
      val kicker = values.first { it != pairs[0] && it != pairs[1] }
      return TexasEvaluation(3, listOf(pairs[0], pairs[1], kicker), cards)
    }

    if (pairs.size == 1) {
      val pair = pairs[0]
      val kickers = values.filter { it != pair }.sortedDescending()
      return TexasEvaluation(2, listOf(pair) + kickers, cards)
    }

    return TexasEvaluation(1, values, cards)
  }

  private fun straightHighCard(values: List<Int>): Int? {
    val unique = values.toSet()
    val expanded = if (unique.contains(14)) unique + 1 else unique
    for (high in 14 downTo 5) {
      val needed = (0..4).map { high - it }
      if (needed.all { expanded.contains(it) }) {
        return high
      }
    }
    return null
  }

  private fun compareTexasEvaluations(left: TexasEvaluation, right: TexasEvaluation): Int {
    if (left.category != right.category) {
      return left.category.compareTo(right.category)
    }

    val maxLength = max(left.ranks.size, right.ranks.size)
    for (index in 0 until maxLength) {
      val leftRank = left.ranks.getOrElse(index) { 0 }
      val rightRank = right.ranks.getOrElse(index) { 0 }
      if (leftRank != rightRank) {
        return leftRank.compareTo(rightRank)
      }
    }

    return 0
  }

  private fun rankValue(rank: String): Int {
    return when (rank) {
      "A" -> 14
      "K" -> 13
      "Q" -> 12
      "J" -> 11
      else -> rank.toIntOrNull() ?: 0
    }
  }

  private fun canActTexas(playerId: String): Boolean {
    val player = players.find { it.id == playerId } ?: return false
    return gameMode == "texasHoldem" &&
      gameStatus == "playing" &&
      pendingPenaltyPlayerId == null &&
      (
        TEXAS_ACTION_STAGES.contains(texasStage) ||
          (texasStage == "preDraw" && pendingTexasDiscardPlayerId == playerId && player.cards.size == 2)
      ) &&
      currentActorId() == playerId &&
      isInTexasHand(player)
  }

  private fun inHandPlayers() = players.filter { isInTexasHand(it) }

  private fun isInTexasHand(player: Player): Boolean {
    return !player.isEliminated && player.texasRoundState == "inHand"
  }

  private fun findNextIndex(startIndex: Int, predicate: (Player) -> Boolean): Int? {
    if (players.isEmpty()) return null
    val start = ((startIndex % players.size) + players.size) % players.size
    repeat(players.size) { offset ->
      val index = (start + offset) % players.size
      if (predicate(players[index])) return index
    }
    return null
  }

  private fun buildDeck() {
    deck.clear()
    val aliveCount = alivePlayers().size
    val rankCount = 6 + max(0, aliveCount - 4) * 2
    val jokerCount = 2 + max(0, aliveCount - 4)
    listOf("Q", "K", "A").forEach { rank ->
      repeat(rankCount) { deck += Card("$rank-$it", rank) }
    }
    repeat(jokerCount) { deck += Card("Joker-$it", "Joker") }
    deck.shuffle()
  }

  private fun checkGameEnd() {
    val activePlayers = alivePlayers()
    if (activePlayers.size <= 1) {
      gameStatus = "ended"
      val placementOrder = liarsPlacementOrder(activePlayers.firstOrNull()?.id.orEmpty())
      val winnerId = placementOrder.firstOrNull() ?: activePlayers.firstOrNull()?.id
      players.forEach { player ->
        if (
          player.id == winnerId ||
          completedLiarsPlayerIds.contains(player.id) ||
          activePlayers.firstOrNull()?.id == player.id
        ) {
          player.setPlaying()
        } else {
          player.setEliminated()
        }
      }
    }
  }

  private fun currentActorId(): String? {
    if (gameStatus != "playing" || pendingPenaltyPlayerId != null) return null
    if (gameMode == "texasHoldem") {
      return pendingTexasDiscardPlayerId ?: players.getOrNull(currentPlayerIndex)?.id
    }
    currentPlay?.let { play ->
      val responder = ensureCurrentLiarsResponderIndex(play.playerId)
      return responder?.let { players[it].id }
    }
    return ensureCurrentLiarsTurnPlayerIndex()?.let { players[it].id }
  }

  private fun ensureCurrentLiarsTurnPlayerIndex(): Int? {
    players.getOrNull(currentPlayerIndex)?.let { currentPlayer ->
      if (!currentPlayer.isEliminated && currentPlayer.isActive) {
        return currentPlayerIndex
      }
    }

    val nextIndex = randomUnplayedLiarsActiveIndex() ?: randomActiveIndex()
    if (nextIndex != null) {
      currentPlayerIndex = nextIndex
    }
    return nextIndex
  }

  private fun ensureCurrentLiarsResponderIndex(playPlayerId: String): Int? {
    val currentResponderIndex = turnActorPlayerId?.let { actorId ->
      players.indexOfFirst { it.id == actorId }.takeIf { it >= 0 }
    }

    if (currentResponderIndex != null) {
      val responder = players[currentResponderIndex]
      if (responder.id != playPlayerId && !responder.isEliminated && responder.isActive) {
        return currentResponderIndex
      }
    }

    val responderIndex = randomUnplayedLiarsActiveIndex(excludePlayerId = playPlayerId)
    turnActorPlayerId = responderIndex?.let { players[it].id }
    return responderIndex
  }

  private fun rememberLiarsTurnCyclePlayedPlayer(playerId: String) {
    if (playerId.isNotBlank()) {
      liarsTurnCyclePlayedPlayerIds += playerId
    }
  }

  private fun unplayedLiarsActiveIndices(excludePlayerId: String? = null): List<Int> {
    return players.mapIndexedNotNull { index, player ->
      index.takeIf {
        !player.isEliminated &&
          player.isActive &&
          player.id != excludePlayerId &&
          !liarsTurnCyclePlayedPlayerIds.contains(player.id)
      }
    }
  }

  private fun randomUnplayedLiarsActiveIndex(excludePlayerId: String? = null): Int? {
    var eligibleIndices = unplayedLiarsActiveIndices(excludePlayerId)

    if (eligibleIndices.isEmpty()) {
      liarsTurnCyclePlayedPlayerIds.clear()
      if (!excludePlayerId.isNullOrBlank()) {
        liarsTurnCyclePlayedPlayerIds += excludePlayerId
      }
      eligibleIndices = unplayedLiarsActiveIndices(excludePlayerId)
    }

    if (eligibleIndices.isEmpty()) return null
    return eligibleIndices.random()
  }

  private fun randomActiveIndex(excludePlayerId: String? = null): Int? {
    val eligibleIndices = players.mapIndexedNotNull { index, player ->
      index.takeIf {
        !player.isEliminated &&
          player.isActive &&
          player.id != excludePlayerId
      }
    }

    if (eligibleIndices.isEmpty()) return null
    return eligibleIndices.random()
  }

  private fun resolveNextRoundStarterIndex(predicate: (Player) -> Boolean): Int? {
    val eligibleIndices = players.mapIndexedNotNull { index, player -> index.takeIf { predicate(player) } }
    if (eligibleIndices.isEmpty()) return null

    val previousStarterIndex = roundStarterPlayerId?.let { starterPlayerId ->
      players.indexOfFirst { it.id == starterPlayerId }.takeIf { it >= 0 }
    }

    if (previousStarterIndex == null) {
      return eligibleIndices.random()
    }

    return findNextIndex(previousStarterIndex + 1, predicate) ?: eligibleIndices.first()
  }

  private fun resolveCurrentRoundStarterIndex(predicate: (Player) -> Boolean): Int? {
    val starterIndex = roundStarterPlayerId?.let { starterPlayerId ->
      players.indexOfFirst { it.id == starterPlayerId }.takeIf { it >= 0 }
    }

    if (starterIndex != null) {
      if (predicate(players[starterIndex])) {
        return starterIndex
      }

      findNextIndex(starterIndex + 1, predicate)?.let { return it }
    }

    return findNextIndex(currentPlayerIndex, predicate)
  }

  private fun resolveLiarsRoundStarterIndex(): Int {
    return randomActiveIndex() ?: 0
  }

  private fun resolveTexasRoundStarterIndex(): Int {
    return resolveNextRoundStarterIndex { player -> isInTexasHand(player) } ?: -1
  }

  private fun resolveTexasActionStageStarterIndex(): Int? {
    return resolveCurrentRoundStarterIndex { player -> isInTexasHand(player) && !player.hasAddedBullets }
  }

  private fun rememberLastActivePlayer(playerId: String) {
    if (playerId.isNotBlank()) {
      lastActivePlayerId = playerId
    }
  }

  private fun isSpectator(player: Player): Boolean {
    return !player.isEliminated &&
      !player.isActive &&
      player.gameState == "waiting" &&
      player.texasRoundState == "waiting" &&
      !roundScoreBaseline.containsKey(player.id)
  }

  private fun alivePlayers() = players.filter { !it.isEliminated && it.isActive }
  private fun canUseHostAction(playerId: String) = isHost(playerId)
  private fun isHost(playerId: String) = players.find { it.id == playerId }?.isHost == true
  private fun notFound() = CommandResult(false, code = "PLAYER_NOT_FOUND", message = "Player not found")
  private fun unauthorized() = CommandResult(false, code = "UNAUTHORIZED_ACTION", message = "Only the host can perform this action")
}
