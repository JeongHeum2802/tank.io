import http from "http";
import express from "express";
import paymentRouter from "./routes/payment";
import { Server } from "colyseus";
import { Encoder } from "@colyseus/schema";
import { WebSocketTransport } from "@colyseus/ws-transport"
import { GameRoom } from "./rooms/GameRoom";
import path from "path";

// 상태 크기가 클 경우 버퍼 오버플로우 방지
Encoder.BUFFER_SIZE = 64 * 1024; // 64 KB

const port = Number(process.env.PORT) || 25565;
const app = express();

app.use(express.json());

// 결제 API 라우터 연결
app.use("/api/payments", paymentRouter);

// 프론트엔드 빌드 정적 파일 서빙
app.use(express.static(path.join(__dirname, "..", "public")));

// SPA 처리를 위한 catch-all 라우팅 (index.html 반환)
// Express 5+ / path-to-regexp v8 에서는 이름 붙은 와일드카드 사용
app.get("/{*path}", (req, res) => {
    res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

const server = http.createServer(app);
const gameServer = new Server({
  transport: new WebSocketTransport({
    server: server
  })
});

// 룸 등록
gameServer.define("game_room", GameRoom);

gameServer.listen(port);
console.log(`[GameServer] Listening on ws://localhost:${port}`);
