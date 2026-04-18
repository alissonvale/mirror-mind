import type { FC } from "hono/jsx";
import { Layout } from "./layout.js";
import { ContextRail, type RailState } from "./context-rail.js";
import type { User, LoadedMessage } from "../../server/db.js";

export const MirrorPage: FC<{
  user: User;
  messages: LoadedMessage[];
  rail: RailState;
}> = ({ user, messages, rail }) => (
  <Layout title="Mirror" user={user} wide>
    <div class="chat-shell">
      <div class="chat-container">
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
                {persona && <span class="persona-badge">◇ {persona}</span>}
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
      </div>
      <ContextRail rail={rail} />
    </div>
    <script src="/public/chat.js?v=s7-2"></script>
  </Layout>
);
