import type { FC } from "hono/jsx";
import { Layout } from "./layout.js";
import type { User } from "../db.js";

export const ChatPage: FC<{ user: User; messages: unknown[] }> = ({
  user,
  messages,
}) => (
  <Layout title="Chat">
    <div id="messages">
      {(messages as any[]).map((msg) => {
        const role = msg.role as string;
        const text =
          typeof msg.content === "string"
            ? msg.content
            : (msg.content as any[])
                .filter((b: any) => b.type === "text")
                .map((b: any) => b.text)
                .join("");
        return (
          <div class={`msg msg-${role}`}>
            <div class="bubble">{text}</div>
          </div>
        );
      })}
    </div>
    <form id="chat-form">
      <input
        type="text"
        id="chat-input"
        placeholder="Type a message..."
        autocomplete="off"
        autofocus
      />
      <button type="submit">Send</button>
    </form>
    <script src="/public/chat.js"></script>
  </Layout>
);
