# AI Coding Agent Sandbox Orchestration Research

Research into open-source projects where an AI coding agent runs OUTSIDE a sandbox and dispatches code execution INTO isolated sandboxes/containers. The "one server orchestrating multiple isolated environments" (multi-tenant) pattern.

---

## TIER 1: Full AI Coding Agents with "Agent Outside, Execution Inside Sandbox" Architecture

These are complete AI coding agent platforms where the agent/orchestrator runs on a server and dispatches work to isolated sandboxes.

### 1. OpenHands (formerly OpenDevin)

- **URL**: https://github.com/OpenHands/OpenHands
- **Stars**: ~70,300
- **Language**: Python
- **License**: Custom (NOASSERTION)
- **Last Updated**: Active daily (2026-03-31)
- **Architecture**: **Exact match for the pattern.** Uses an event stream architecture where all agent-environment interactions flow as typed events through a central hub. The Agent (running on the server) analyzes conversation state and produces Actions (CmdRunAction, FileWriteAction, BrowseURLAction, etc.), while the Runtime executes Actions in isolated Docker container sandboxes and returns Observations. An API server runs inside the Docker sandbox to listen for action execution requests. The agent logic runs locally/on-server (low latency, private), while tool execution runs remotely (isolated, scalable). Communication is via WebSocket with auto-reconnection and state sync.
- **Multi-Tenant**: The open-source version is single-user. OpenHands Cloud (commercial) is a centralized multi-tenant server scaling to thousands of coding agents with PostgreSQL-backed multi-tenancy, RBAC, and billing integration. OpenHands Enterprise allows self-hosted multi-tenant deployments on Kubernetes.
- **Key Insight**: The Agent Server package provides an HTTP API server for remote agent execution, enabling building multi-user systems, SaaS products, and distributed agent platforms. Transitioning from file-based (V0) to PostgreSQL-backed architecture (V1).

### 2. SWE-agent + SWE-ReX

- **URL**: https://github.com/SWE-agent/SWE-agent (agent) / https://github.com/SWE-agent/SWE-ReX (runtime)
- **Stars**: ~18,900 (SWE-agent) / ~470 (SWE-ReX)
- **Language**: Python
- **License**: MIT
- **Last Updated**: Active daily (2026-03-30)
- **Architecture**: **Exact match.** SWE-ReX is a dedicated runtime interface for interacting with sandboxed shell environments. The agent runs outside; SWE-ReX starts containers (Docker, AWS Fargate, Modal, or local) and provides a RemoteRuntime that connects to a swerex-remote server inside the container to execute commands. The agent code remains identical regardless of whether execution is local Docker or remote cloud. SWE-ReX recognizes when commands finish, extracts output and exit codes, and returns them to the agent.
- **Multi-Tenant**: Supports massively parallel agent runs. Designed for scaling to large benchmark evaluations with many concurrent sandbox instances.
- **Key Insight**: Clean separation between agent logic and execution runtime. SWE-ReX is a standalone package that can be used by any agent, not just SWE-agent.

### 3. LangChain Open SWE

- **URL**: https://github.com/langchain-ai/open-swe
- **Stars**: ~8,900
- **Language**: Python
- **License**: MIT
- **Last Updated**: Active daily (2026-03-31)
- **Architecture**: **Exact match.** Built on LangGraph and Deep Agents. Three specialized agents work in sequence (Manager -> Planner -> Programmer with sub-agent Reviewer). Every task runs in a secure, isolated Daytona sandbox. Each session gets its own sandbox, so the agent can execute any shell command without risk. The cloud-native architecture means it can work on multiple tasks in parallel without consuming local resources.
- **Multi-Tenant**: Yes, by design. Each task runs in its own isolated cloud sandbox. Multiple tasks execute in parallel.
- **Key Insight**: GitHub integration allows starting tasks from issues or PR comments. Represents the "production-grade" pattern of agent-outside-sandbox.

### 4. Composio Agent Orchestrator

- **URL**: https://github.com/ComposioHQ/agent-orchestrator
- **Stars**: ~5,600
- **Language**: TypeScript
- **License**: MIT
- **Last Updated**: Active daily (2026-03-31)
- **Architecture**: **Strong match.** Dual-layered: a Planner handles task decomposition, an Executor handles tool interaction in isolation. The orchestrator reads your codebase, decomposes features into parallelizable tasks, assigns each to a coding agent in isolated git worktrees, and monitors progress. Spawns multiple agents in isolated worktrees.
- **Multi-Tenant**: Each agent operates independently in isolated git worktrees. Handles CI fixes, merge conflicts, and code reviews autonomously.
- **Key Insight**: The parent Composio platform (27,600 stars) provides the sandboxed workbench, 1000+ tool integrations, auth management, and just-in-time context management.

### 5. Plandex

- **URL**: https://github.com/plandex-ai/plandex
- **Stars**: ~14,200
- **Language**: Go
- **License**: MIT (reported)
- **Last Updated**: Active
- **Architecture**: **Good match.** Client-server architecture where the Plandex server can be self-hosted or cloud-hosted. The AI agent works in a cumulative diff review sandbox -- all AI-generated changes are kept in a separate version-controlled staging area (not your project files) until you approve them. The server orchestrates the AI planning and execution while keeping changes isolated.
- **Multi-Tenant**: Server supports multiple users. Dockerized local mode for self-hosting.
- **Key Insight**: Unique "sandbox" approach -- not container isolation but version-control isolation. Changes accumulate in a separate git-like staging area. Handles 2M tokens of context.

### 6. Codel

- **URL**: https://github.com/semanser/codel
- **Stars**: ~2,450
- **Language**: TypeScript (Go backend)
- **License**: AGPL-3.0
- **Last Updated**: 2024-04-29 (inactive)
- **Architecture**: **Exact match.** Fully autonomous AI Agent that runs in a Docker sandbox. The agent orchestrator runs outside, dispatching terminal commands, browser actions, and file edits into the sandboxed Docker container. Auto-picks Docker images based on user tasks. All history stored in PostgreSQL.
- **Multi-Tenant**: Single-user design but server-based.
- **Key Insight**: Early implementation of this pattern (2024). Not actively maintained but architecturally clean. Web UI for interaction.

---

## TIER 2: Sandbox Infrastructure / Runtimes (the "execution layer" that agents connect to)

These are not coding agents themselves, but the sandbox platforms that enable the "agent outside, code inside" pattern. An AI agent server would use these as its execution backend.

### 7. Daytona

- **URL**: https://github.com/daytonaio/daytona
- **Stars**: ~70,900
- **Language**: TypeScript
- **License**: AGPL-3.0
- **Last Updated**: Active daily (2026-03-31)
- **Architecture**: Secure, elastic infrastructure for running AI-generated code. Provides full composable sandboxes manageable via SDKs (Python, TypeScript, Ruby, Go), CLI, and API. Container-based isolation with OCI/Docker compatibility. Sub-90ms startup times. Each execution runs in a completely isolated sandbox.
- **Multi-Tenant**: Yes. Designed for multi-tenant SaaS use. Self-hostable or managed cloud.
- **Tech Stack**: TypeScript, container orchestration, OCI-compatible
- **Key Insight**: Used by LangChain Open SWE and many others as the sandbox backend. Raised $24M Series A in Feb 2026. The most popular open-source sandbox runtime.

### 8. E2B

- **URL**: https://github.com/e2b-dev/E2B
- **Stars**: ~11,500
- **Language**: Python
- **License**: Apache-2.0
- **Last Updated**: Active (2026-03-30)
- **Architecture**: Open-source secure cloud runtime for AI applications. Sandboxed Linux environments powered by Firecracker microVMs. Define environments via custom templates, agents provision sandboxes on demand via Python or TypeScript SDK. Each sandbox has its own filesystem, process tree, and network namespace. Boots in under a second.
- **Multi-Tenant**: Scaled from 40K to 15M sandboxes/month in one year. Full lifecycle management, SSH access, webhooks, session reconnection.
- **Tech Stack**: Python, Firecracker microVMs, custom orchestration
- **Key Insight**: The pioneer of the "sandbox-as-a-service for AI agents" category. BYOC option on AWS for enterprise. De facto standard protocol that others (like agent-sandbox) implement compatibility with.

### 9. Alibaba OpenSandbox

- **URL**: https://github.com/alibaba/OpenSandbox
- **Stars**: ~9,600
- **Language**: Python
- **License**: Apache-2.0
- **Last Updated**: Active (2026-03-30)
- **Architecture**: General-purpose sandbox platform with multi-language SDKs (Java/Kotlin, Python, JS/TS, C#/.NET), unified sandbox APIs, and Docker/Kubernetes runtimes. Supports gVisor, Kata Containers, and Firecracker microVM for isolation. Kubernetes operator manages sandbox environments through CRDs with automated lifecycle management, resource pooling, batch creation.
- **Multi-Tenant**: Enterprise-grade. Unified ingress gateway with multiple routing strategies plus per-sandbox egress controls.
- **Tech Stack**: Python, Kubernetes, multiple isolation runtimes
- **Key Insight**: From Alibaba's internal infrastructure. Includes examples for Claude Code, Gemini CLI, and other agents. The most enterprise-ready open-source option.

### 10. Microsandbox

- **URL**: https://github.com/superradcompany/microsandbox
- **Stars**: ~5,200
- **Language**: Rust
- **License**: Apache-2.0
- **Last Updated**: Active daily (2026-03-31)
- **Architecture**: Local-first sandbox platform using libkrun microVMs (hardware-level virtualization). Sub-200ms startup. OCI-compatible (standard Docker images). MCP integration for AI agents.
- **Multi-Tenant**: Self-hosted, 100% open source, no vendor lock-in. Each sandbox runs its own kernel.
- **Tech Stack**: Rust, libkrun microVMs, MCP
- **Key Insight**: YC X26 backed (Zerocore AI). Focus on local-first + security. Best option for self-hosted microVM isolation without cloud dependency.

### 11. Agent-Infra AIO Sandbox

- **URL**: https://github.com/agent-infra/sandbox
- **Stars**: ~3,900
- **Language**: Python
- **License**: Apache-2.0
- **Last Updated**: Active (2026-03-28)
- **Architecture**: All-in-one Docker container combining Browser, Shell, File, MCP, and VSCode Server. Single API/SDK for all operations. Files downloaded in the browser are immediately accessible via shell. Pre-configured MCP servers expose sandbox capabilities to LLMs via standardized protocol.
- **Multi-Tenant**: Docker, docker-compose, and Kubernetes deployment support.
- **Tech Stack**: Python, Docker, MCP, VNC browser, VS Code, Jupyter
- **Key Insight**: The "batteries-included" option. One container gives you everything an agent needs. SDKs for Python, TypeScript, and Go.

### 12. ZeroBoot

- **URL**: https://github.com/zerobootdev/zeroboot
- **Stars**: ~2,000
- **Language**: Rust
- **License**: Apache-2.0
- **Last Updated**: 2026-03-21
- **Architecture**: Sub-millisecond VM sandboxes using copy-on-write (CoW) memory forking. Creates a Firecracker snapshot, then uses mmap(MAP_PRIVATE) to map it as CoW in a KVM VM with restored CPU state in ~0.8ms. Only ~265KB memory per sandbox.
- **Multi-Tenant**: Can spawn thousands of sandboxes per second. Hardware-enforced memory isolation.
- **Tech Stack**: Rust, Firecracker microVMs, KVM, CoW memory forking
- **Key Insight**: The fastest sandbox creation by far (0.8ms vs. 90-200ms for others). Best for high-throughput multi-tenant scenarios where you need to spin up/down sandboxes very rapidly.

### 13. VibeKit

- **URL**: https://github.com/superagent-ai/vibekit
- **Stars**: ~1,800
- **Language**: TypeScript
- **License**: MIT
- **Last Updated**: 2026-01-13
- **Architecture**: SDK for running Claude Code, Gemini, Codex, or any coding agent in isolated Docker containers. Built-in secret redaction, real-time logs/traces/metrics. Works offline and locally.
- **Multi-Tenant**: Supports multiple sandbox providers (E2B, with Daytona/Modal/Fly.io planned).
- **Tech Stack**: TypeScript SDK, Docker, multiple sandbox backends
- **Key Insight**: YC W24 company (Superagent). Focus on wrapping existing coding agents (Claude Code, Codex) in sandboxes rather than building a new agent.

### 14. BoxLite

- **URL**: https://github.com/boxlite-ai/boxlite
- **Stars**: ~1,700
- **Language**: Rust
- **License**: Apache-2.0
- **Last Updated**: Active (2026-03-30)
- **Architecture**: Local-first micro-VM sandbox. Embeddable as a single importable library -- no cloud, no daemons, no root required. Stateful persistent workspaces (unlike ephemeral sandboxes). Snapshot/restore for checkpointing before risky operations. Each Box runs its own kernel (not just namespaces).
- **Multi-Tenant**: Hardware isolation between boxes. Parallel exploration via environment forking.
- **Tech Stack**: Rust, micro-VMs, OCI-compatible
- **Key Insight**: Unique "embeddable library" approach. Best for integrating sandbox capabilities directly into your own agent application without external services.

### 15. Kubernetes Agent Sandbox (k8s-sigs)

- **URL**: https://github.com/kubernetes-sigs/agent-sandbox
- **Stars**: ~1,600
- **Language**: Go
- **License**: Apache-2.0
- **Last Updated**: Active daily (2026-03-31)
- **Architecture**: Kubernetes CRD and controller for managing isolated, stateful, singleton workloads. Provides a declarative API for sandbox lifecycle. Two-tier architecture separating core Pod/Service/PVC management from enterprise features (templates, claims, warm pools). Supports gVisor and Kata Containers for kernel/network isolation.
- **Multi-Tenant**: Native Kubernetes multi-tenancy. Warm pools for fast provisioning. Deep hibernation with state persistence.
- **Tech Stack**: Go, Kubernetes operator, gVisor/Kata support
- **Key Insight**: Official Kubernetes SIG project. The standard way to run agent sandboxes on K8s. Google Cloud documentation covers using it for AI agent code execution.

### 16. Rivet Sandbox Agent SDK

- **URL**: https://github.com/rivet-dev/sandbox-agent
- **Stars**: ~1,200
- **Language**: TypeScript (binary in Rust)
- **License**: Apache-2.0
- **Last Updated**: Active (2026-03-30)
- **Architecture**: Universal HTTP API for controlling coding agents inside sandboxes. A 15MB static Rust binary runs inside the sandbox, exposing HTTP/SSE endpoints. Supports Claude Code, Codex, OpenCode, and Amp through one unified API. Solves API fragmentation (Claude Code uses JSONL over stdout, Codex uses JSON-RPC, etc.).
- **Multi-Tenant**: Designed for remote control. Works with Daytona, E2B, Vercel Sandboxes, Docker, and more.
- **Tech Stack**: Rust binary, HTTP/SSE, provider-agnostic
- **Key Insight**: Solves the "how do I talk to different coding agents uniformly from outside the sandbox" problem. You run one server, and it normalizes all agent protocols to HTTP.

### 17. Arrakis

- **URL**: https://github.com/abshkbh/arrakis
- **Stars**: ~790
- **Language**: Go
- **License**: AGPL-3.0
- **Last Updated**: 2025-06-02 (somewhat inactive)
- **Architecture**: Self-hosted sandboxing using MicroVMs (cloud-hypervisor VMM). Each sandbox runs Ubuntu with code execution service + VNC server. Overlayfs protects root filesystem. REST API, Python SDK, and MCP server for programmatic control.
- **Multi-Tenant**: Each sandbox isolated from host and other agents. Snapshot-and-restore for backtracking.
- **Tech Stack**: Go, cloud-hypervisor, MicroVMs, overlayfs
- **Key Insight**: Linux-only (requires /dev/kvm). Unique backtracking/snapshot feature useful for agent exploration.

### 18. CelestoAI SmolVM

- **URL**: https://github.com/CelestoAI/SmolVM
- **Stars**: ~194
- **Language**: Python
- **License**: Apache-2.0
- **Last Updated**: 2026-03-29
- **Architecture**: Python SDK and CLI for running code/browser tasks in disposable microVM sandboxes. Uses Firecracker on Linux (KVM), QEMU on macOS. Sub-second boot times. Built-in NAT, port forwarding, SSH tunneling.
- **Multi-Tenant**: Lightweight enough for many concurrent instances.
- **Tech Stack**: Python, Firecracker/QEMU
- **Key Insight**: Simplest Python SDK for microVM sandboxes. Good for prototyping the agent-outside pattern.

### 19. agent-sandbox (E2B-compatible)

- **URL**: https://github.com/agent-sandbox/agent-sandbox
- **Stars**: ~93
- **Language**: Go
- **License**: Apache-2.0
- **Last Updated**: 2026-03-26
- **Architecture**: E2B-compatible, enterprise-grade cloud-native runtime on Kubernetes. RESTful API + MCP server for sandbox lifecycle management. Supports code execution, browser automation, computer use, shell commands.
- **Multi-Tenant**: Explicitly multi-session and multi-tenant. Multiple sandbox lifecycle management per tenant/session.
- **Tech Stack**: Go, Kubernetes, E2B-compatible protocol
- **Key Insight**: Drop-in replacement for E2B that you self-host on your own Kubernetes cluster.

---

## TIER 3: Full Agent Platforms with Notable Sandbox/Isolation Features

These are broader AI agent platforms that include sandbox capabilities but are not specifically "coding agent + sandbox" systems.

### 20. Cua (Computer-Use Agents)

- **URL**: https://github.com/trycua/cua
- **Stars**: ~13,300
- **Language**: Python
- **License**: MIT
- **Last Updated**: Active daily (2026-03-31)
- **Architecture**: Infrastructure for Computer-Use Agents (controlling full desktops). Agent SDK connects frontier AI models to virtual computers. Uses Apple Virtualization.Framework on macOS (97% native CPU speed). REST APIs and gRPC for production deployments.
- **Multi-Tenant**: Horizontal scaling supported. Each agent gets an isolated VM.
- **Key Insight**: YC-backed. Not a coding agent per se, but the VM-based agent-outside pattern applies. Best for desktop automation use cases.

### 21. OpenCode

- **URL**: https://github.com/anomalyco/opencode
- **Stars**: ~133,200
- **Language**: TypeScript
- **License**: MIT
- **Last Updated**: Active daily (2026-03-31)
- **Architecture**: Client-server architecture supporting both local and remote (HTTP) operation modes. TUI is just one client; can be driven remotely (e.g., from mobile app). However, OpenCode does NOT sandbox the agent by default -- permission system is UX only. You must run it inside Docker/VM yourself for isolation.
- **Multi-Tenant**: Client-server design enables remote multi-user access.
- **Key Insight**: Massive community (133K stars). Agent-outside pattern via client-server but no built-in sandboxing.

### 22. Goose (by Block/Square)

- **URL**: https://github.com/block/goose
- **Stars**: ~33,800
- **Language**: Rust
- **License**: Apache-2.0
- **Last Updated**: Active daily (2026-03-31)
- **Architecture**: Extensible AI agent using MCP (Model Context Protocol) for tool integration. Available as desktop app and CLI. Does NOT have built-in sandbox isolation -- runs directly on your machine.
- **Multi-Tenant**: Single-user by design.
- **Key Insight**: Significant project (Block/Square backing) but operates locally without sandbox isolation. Could be paired with any Tier 2 sandbox.

---

## TIER 4: Curated Reference Lists

### 23. awesome-sandbox

- **URL**: https://github.com/restyler/awesome-sandbox
- Comprehensive curated list and analysis of all modern code sandboxing solutions for AI.

### 24. awesome-cli-coding-agents

- **URL**: https://github.com/bradAGI/awesome-cli-coding-agents
- Curated directory of 80+ terminal-native AI coding agents and orchestration harnesses.

### 25. arjan/awesome-agent-sandboxes

- **URL**: https://github.com/arjan/awesome-agent-sandboxes
- Curated list of code-execution sandboxing solutions for AI/LLM agents.

---

## Architecture Pattern Summary

The "agent outside, execution inside sandbox" pattern has three main implementation approaches:

### Pattern A: Integrated Agent + Sandbox (Tier 1)

The agent and sandbox are built together as one system.

- **Best examples**: OpenHands, SWE-agent/SWE-ReX, LangChain Open SWE, Codel
- **Pros**: Tightest integration, purpose-built for the workflow
- **Cons**: Tied to that specific agent implementation

### Pattern B: Sandbox-as-Infrastructure (Tier 2)

A standalone sandbox service that any agent can connect to via API/SDK.

- **Best examples**: Daytona, E2B, OpenSandbox, Microsandbox, ZeroBoot
- **Pros**: Agent-agnostic, can swap agents without changing infrastructure
- **Cons**: Requires integration work, agent must know how to use the sandbox API

### Pattern C: Agent Wrapper / Universal API (Hybrid)

Wraps existing coding agents (Claude Code, Codex, etc.) in sandboxes with a unified API.

- **Best examples**: VibeKit, Rivet Sandbox Agent SDK
- **Pros**: Use any existing coding agent immediately, unified API across agents
- **Cons**: Limited to what the wrapped agent can do

---

## Recommendations for "One Server, Multi-Tenant" Architecture

For building a system where one server orchestrates multiple isolated environments:

| Requirement                              | Best Option                                            |
| ---------------------------------------- | ------------------------------------------------------ |
| Full coding agent + sandbox, most mature | **OpenHands** (with Enterprise/Cloud for multi-tenant) |
| Clean agent/runtime separation           | **SWE-agent + SWE-ReX**                                |
| Production async coding agent            | **LangChain Open SWE** (uses Daytona)                  |
| Best standalone sandbox runtime          | **Daytona** (71K stars, sub-90ms, AGPL)                |
| Best open sandbox with enterprise K8s    | **Alibaba OpenSandbox** (Apache-2.0)                   |
| Fastest sandbox creation                 | **ZeroBoot** (0.8ms, Rust)                             |
| Self-hosted microVM without cloud        | **Microsandbox** (Rust, Apache-2.0)                    |
| Standard K8s integration                 | **kubernetes-sigs/agent-sandbox**                      |
| Wrapping existing agents in sandbox      | **VibeKit** or **Rivet Sandbox Agent SDK**             |
| Multi-agent parallel orchestration       | **Composio Agent Orchestrator**                        |

---

## Isolation Technology Comparison

| Technology           | Startup Time | Memory Overhead | Isolation Level               | Used By                        |
| -------------------- | ------------ | --------------- | ----------------------------- | ------------------------------ |
| Docker containers    | ~500ms-2s    | ~50MB           | Process-level (shared kernel) | OpenHands, Codel, AIO Sandbox  |
| gVisor               | ~200-500ms   | ~20-50MB        | User-space kernel             | OpenSandbox, K8s Agent Sandbox |
| Firecracker microVMs | ~100-200ms   | ~5-30MB         | Hardware-level VM             | E2B, ZeroBoot, SmolVM          |
| Kata Containers      | ~500ms-1s    | ~30-60MB        | Hardware-level VM             | OpenSandbox, K8s Agent Sandbox |
| libkrun microVMs     | ~150-200ms   | ~10-20MB        | Hardware-level VM             | Microsandbox                   |
| cloud-hypervisor     | ~200-500ms   | ~20-50MB        | Hardware-level VM             | Arrakis                        |
| CoW VM forking       | ~0.8ms       | ~265KB          | Hardware-level VM             | ZeroBoot                       |
