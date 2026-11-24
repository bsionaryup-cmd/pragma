# ADR-003 — Tool schema, prompts y motor dual

**Estado:** Aceptado  
**Fecha:** 2026-07-31  

## Decisión

1. **Motor primario:** LLM con tool-calling (`DIGITAL_RECEPTIONIST_AGENT_ENGINE=llm`) cuando hay `OPENAI_API_KEY`.  
2. **Fallback:** `decideDigitalReceptionistReply` (determinista) si LLM falla, no está configurado, o policy lo exige.  
3. **Prompts:** versionados (`PROMPT_VERSION=v1`); hash en audit.  
4. **Tools:** JSON schema fijo; runners llaman servicios de dominio; Phase F sigue bloqueando writes peligrosas en AUTONOMOUS.  
5. **Guardrails post-LLM:** `evaluateReceptionRules` + rechazo de códigos inventados.  
6. **Rollout:** SUPERVISED (draft / no send cloud) → AUTONOMOUS gradual (FAQ/links primero).

## Tool contract (v1)

- `get_guest_context` (R)
- `search_availability` (R) — respuesta honest “consultar / escalar” si no hay API calendárica completa
- `get_faq_answer` (R)
- `send_guest_registration_link` (R/W leve ensure GR)
- `send_stay_portal_link` (R)
- `create_reservation_draft` (W gated → draft/escalate only en v1)
- `escalate_to_human` (W flag)
- `send_access_code` — blocked / refuse

## Alternativas rechazadas

| Opción | Motivo |
|--------|--------|
| Solo LLM sin fallback | Outages / costo |
| Solo regex | No conversación natural |
| SQL libre desde el modelo | Seguridad |
