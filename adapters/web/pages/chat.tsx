import type { FC } from "hono/jsx";
import { Layout } from "./layout.js";
import type { User, LoadedMessage } from "../../server/db.js";

export const ChatPage: FC<{ user: User; messages: LoadedMessage[] }> = ({
  user,
  messages,
}) => (
  <Layout title="Chat">
    <div id="messages">
      {messages.map(({ data: msg, meta }) => {
        const role = msg.role as string;
        const text =
          typeof msg.content === "string"
            ? (msg.content as string)
            : ((msg.content as any[]) ?? [])
                .filter((b: any) => b.type === "text")
                .map((b: any) => b.text)
                .join("");
        const persona = meta.persona as string | undefined;
        return (
          <div class={`msg msg-${role}`}>
            {persona && <div class="signature">◇ {persona}</div>}
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
