"use client";

import {
  Bold,
  Code,
  Italic,
  Link2,
  List,
  ListOrdered,
  Mail,
  Paperclip,
  Send,
  Sparkles,
  Underline,
} from "lucide-react";
import type { InboxConversation } from "@/types/inbox";
import { cn } from "@/lib/utils";

type InboxChatPanelProps = {
  conversation: InboxConversation;
};

function Avatar({
  initial,
  variant,
}: {
  initial: string;
  variant: "guest" | "host";
}) {
  return (
    <span
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
        variant === "guest"
          ? "bg-[#edf894] text-[#1a1a1a]"
          : "bg-[#e8e8e8] text-[#4a4a4a]",
      )}
    >
      {initial}
    </span>
  );
}

export function InboxChatPanel({ conversation }: InboxChatPanelProps) {
  return (
    <section className="flex min-w-0 flex-1 flex-col border-r border-[#e8e8e8] bg-white">
      <header className="flex items-center justify-between border-b border-[#e8e8e8] px-5 py-4">
        <div className="flex items-center gap-3">
          <Avatar initial={conversation.guestInitial} variant="guest" />
          <div>
            <p className="text-sm font-semibold text-[#1a1a1a]">
              {conversation.guestName}
            </p>
            <p className="text-xs text-[#6b6b6b]">{conversation.lastMessageAt}</p>
          </div>
        </div>
        <button
          type="button"
          className="text-[#4a4a4a] hover:text-[#1a1a1a]"
          aria-label="Correo"
        >
          <Mail className="h-5 w-5" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-6">
        <div className="mb-6 flex justify-center">
          <span className="rounded-full bg-[#f3f3f3] px-4 py-1.5 text-xs text-[#6b6b6b]">
            {conversation.dateSeparator}
          </span>
        </div>

        <div className="space-y-6">
          {conversation.messages.map((message) => (
            <article key={message.id} className="flex gap-3">
              <Avatar
                initial={message.senderInitial}
                variant={message.sender === "guest" ? "guest" : "host"}
              />
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-baseline gap-2">
                  <span className="text-sm font-semibold text-[#1a1a1a]">
                    {message.senderName}
                  </span>
                  <span className="text-xs text-[#9a9a9a]">{message.time}</span>
                </div>
                <p className="text-sm leading-relaxed text-[#1a1a1a]">
                  {message.body}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>

      <footer className="border-t border-[#e8e8e8] p-4">
        <div className="mb-2 flex items-center gap-1 text-[#6b6b6b]">
          <button type="button" className="rounded p-1.5 hover:bg-[#f3f3f3]" aria-label="Negrita">
            <Bold className="h-4 w-4" />
          </button>
          <button type="button" className="rounded p-1.5 hover:bg-[#f3f3f3]" aria-label="Cursiva">
            <Italic className="h-4 w-4" />
          </button>
          <button type="button" className="rounded p-1.5 hover:bg-[#f3f3f3]" aria-label="Subrayado">
            <Underline className="h-4 w-4" />
          </button>
          <button type="button" className="rounded p-1.5 hover:bg-[#f3f3f3]" aria-label="Lista">
            <List className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="rounded p-1.5 hover:bg-[#f3f3f3]"
            aria-label="Lista numerada"
          >
            <ListOrdered className="h-4 w-4" />
          </button>
          <button type="button" className="rounded p-1.5 hover:bg-[#f3f3f3]" aria-label="Enlace">
            <Link2 className="h-4 w-4" />
          </button>
          <button type="button" className="rounded p-1.5 hover:bg-[#f3f3f3]" aria-label="Código">
            <Code className="h-4 w-4" />
          </button>
        </div>

        <textarea
          rows={4}
          placeholder=""
          className="mb-3 w-full resize-none rounded-lg border border-[#e0e0e0] bg-white px-3 py-2 text-sm text-[#1a1a1a] outline-none focus:border-[#c8c8c8]"
        />

        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-4 text-sm text-[#4a4a4a]">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 hover:text-[#1a1a1a]"
            >
              <Paperclip className="h-4 w-4" />
              Adjuntar
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 hover:text-[#1a1a1a]"
            >
              <Mail className="h-4 w-4" />
              Respuestas rápidas
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 hover:text-[#1a1a1a]"
            >
              <Sparkles className="h-4 w-4" />
              Generar con IA
            </button>
          </div>
          <button
            type="button"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#e8e8e8] text-[#4a4a4a] hover:bg-[#dcdcdc]"
            aria-label="Enviar"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </footer>
    </section>
  );
}
