# Project Plan Prompt: Open Agentic Web Handoff

Copy the prompt below into your preferred AI agent to produce and maintain the project plan.

---

## Prompt

Act as a senior product architect and security-minded web engineer. Create a practical, implementation-ready project plan for an open agentic website that lets a person bring an existing AI agent into a website task, authorize the needed access, and let that agent continue helping them.

### Product idea

Build an open, interoperable agentic **test website** and deploy it publicly on Vercel. The demo site should provide a small, realistic task flow that can be completed by a person or continued by an AI agent the person already uses. A user can begin a task on the site, then share or open an authorization link from their existing agent. After reviewing the request and permissions, the user grants that agent limited access to continue the task on the site. The site exposes its agent capabilities through the standard open web artifacts and, where useful, an MCP server or API.

The site must not require the user to configure an LLM, enter an LLM API key, or select a model. The user's existing AI agent supplies the reasoning and model access. The website publishes capabilities and handles the user-authorized work. Keep any site-owned model use optional and outside the core user flow.

Use this user-provided video as product inspiration: https://youtu.be/0avLDin5ZYY?si=i7VRyFmR2mjxf73b . Do not claim details about the video that you cannot verify; label assumptions clearly.

### Mandatory specification

The plan must conform to the current MVP specification:
https://github.com/cognizant-ai-labs/agentic-web/blob/main/docs/worldwide_agentic_web_mvp_spec.md

At minimum, account for a publicly accessible `agent-manifest.json`, a public resolved JSON agent-network definition, `links.json`, a browser JavaScript runtime, an interface for people or agents to interact with the network, and cross-origin CORS support for public artifacts. The website should be loadable and callable by another conforming agentic website. Include a grounded capability through MCP or a registered local site action.

Deploy the test website to Vercel. Plan for production HTTPS, Vercel build/output settings, environment variables for server-side secrets, preview deployments, and route/header configuration so the public agent artifacts are fetchable cross-origin. Specify how the deployed URL will be used to verify manifest and network loading from an independent origin. Do not assume a Vercel deployment alone provides MCP authentication or user authorization; include any required serverless/API routes or an explicitly scoped external MCP service.

Treat the specification as the source of truth. Distinguish its mandatory requirements from optional extensions and from this product's additional authorization-link feature. The specification's browser runtime runs published peer networks in the caller's browser with the caller's active inference router; the peer must not receive or replace the caller's LLM credential. The user must approve contact with external origins. Private context is denied across network boundaries unless specific fields are explicitly allowed. Execution must be bounded and fail closed.

### Authorization and trust requirements

Design the shareable authorization flow as a product extension without weakening the MVP rules:

- A shareable URL must not itself be a bearer credential or contain secrets, LLM keys, private context, or long-lived access tokens.
- Use a short-lived, one-time or revocable task reference; require the recipient agent to identify itself and the user to authenticate/approve the actual scopes before access is granted.
- Bind approval to the specific task, requesting origin/agent, allowed capabilities, data fields, and expiry. Make revocation and an audit trail visible.
- Read-only access should be separated from actions that change data. Show the user the destination, proposed action, and arguments before writes or irreversible actions.
- Define how the site verifies an authorization grant, how an agent exchanges it for scoped access, and how MCP/API calls remain tied to the user's authorization. Never trust model-generated claims of consent.
- Cover replay, link forwarding, expiry, revocation, origin spoofing, confused-deputy behavior, prompt injection, excessive scope, and uncertain outcomes after a write timeout.
- State which protections belong in the browser runtime, which belong on the website's authenticated backend, and which are deferred.

### Planning output

Produce a project plan, not implementation code. Make it specific enough for a small team to start building. Include:

1. **Executive summary**: working name, target user, problem, product promise, and why this is a meaningful open-agentic-web project.
2. **Product boundaries**: MVP user journeys, explicit non-goals, and assumptions to validate.
3. **Architecture**: browser runtime, published artifacts, user-facing site, authorization service, MCP/API bridge, identity/session handling, and optional third-party agent integrations. Include a Mermaid component diagram and explain the trust boundaries.
4. **End-to-end flows**: (a) user starts a task, (b) user shares/opens the authorization link in their existing agent, (c) the agent requests access, (d) user approves selected scopes, (e) agent performs a read or proposes a write, and (f) user revokes access. Include the standard peer-network loading flow separately from the authorization-link extension.
5. **Specification compliance matrix**: each MVP requirement, planned implementation, proof/demo evidence, and status. Clearly mark mandatory, optional, and extension items.
6. **Work breakdown and milestones**: sequenced milestones with deliverables, dependencies, acceptance criteria, and rough effort. Include a first working vertical slice, cross-origin interoperability, authorization hardening, deployment, and demo preparation.
7. **API/MCP design outline**: candidate tools/resources, input/output schemas, authorization checks, idempotency/request IDs, error/unknown-outcome behavior, and how to keep credentials out of prompts and logs. Keep it at planning level.
8. **Data model outline**: task, capability, grant, agent/network identity, audit event, expiry/revocation. Identify sensitive fields and retention choices.
9. **Security, privacy, and abuse review**: threat, mitigation, and residual risk. Include browser/CORS limits, storage, CSP, CSRF, replay, prompt injection, and service-side authorization.
10. **Test and demonstration plan**: functional, interoperability, negative/security checks, and a short browser demo that proves the Vercel-hosted site can be called by an independent agent. Include deployment smoke checks for the public manifest, resolved network JSON, `links.json`, HTTPS, and CORS from a separate origin. Include the required public website URL, screenshots, open-source repository/license, and a concise demo video as deliverables where relevant.
11. **Risks and decisions**: separate known facts, assumptions, unresolved choices, and decisions that should be made early. Recommend sensible defaults rather than blocking the plan on questions.
12. **Suggested repository structure** and a concise definition of done.

### Constraints and guidance

- Prefer ordinary HTTPS hosting, HTML, CSS, JavaScript/TypeScript, JSON, JSON Schema, browser security boundaries, and MCP where it adds value.
- Use Vercel as the hosting target for the test website; keep the plan deployable on its free/standard web hosting model unless a specific backend need requires a different service.
- Keep agent-network definitions declarative and public. Do not put confidential prompts, credentials, or private task data in published artifacts.
- Do not make a central agent registry a dependency.
- The user brings their own agent and inference. Do not add an LLM setup screen to the website as an MVP requirement.
- Avoid vague claims such as “secure by design.” Tie each security claim to a specific mechanism and test.
- Do not conflate loading a peer agent network in the caller's browser with remotely invoking an authenticated website action. Explain the two paths and their different trust/authentication requirements.
- Be candid that MCP authentication and cross-site action transport may need a product-specific bridge beyond the specification's minimum.
- Keep the first version narrow: demonstrate one complete, useful task with read-only access and one user-confirmed write, rather than a generic platform with many unfinished capabilities.
- Present effort estimates as ranges and state the team-size assumptions.
- Link to primary sources for claims about the specification and competition requirements. Recheck those sources if their requirements may have changed.

Return the result in clear Markdown, with concise tables where they improve scanability. Start with the recommended MVP and finish with the first five implementation tasks in order.

---

### Reference links

- Open Agentic Web MVP specification: https://github.com/cognizant-ai-labs/agentic-web/blob/main/docs/worldwide_agentic_web_mvp_spec.md
- Challenge page and submission requirements: https://cognizant-agenticweb.devpost.com/
- User-provided inspiration video: https://youtu.be/0avLDin5ZYY?si=i7VRyFmR2mjxf73b
