# RemoteIQ Windows Agent (C# / .NET 8)

Runs as a Windows Service, enrolls with the backend, and periodically sends heartbeat, metrics, and inventory. Supports jobs and auto-update.

## Build

```powershell
cd remoteiq-minimal-e2e\agent-windows\RemoteIQ.Agent
dotnet build -c Release
# or publish a trimmed win-x64 exe
dotnet publish -c Release -r win-x64 --self-contained false
```

## Install as Windows Service

```powershell
# Copy publish output to a folder, e.g.
$dst = "C:\Program Files\RemoteIQ Agent"
New-Item -ItemType Directory -Path $dst -Force | Out-Null
Copy-Item .\bin\Release\net8.0-windows10.0.17763.0\win-x64\publish\* $dst -Recurse -Force

# Install service
sc.exe create "RemoteIQAgent" binPath= "`"$dst\RemoteIQ.Agent.exe`"" start= auto
sc.exe description "RemoteIQAgent" "RemoteIQ RMM Windows Agent"
sc.exe start "RemoteIQAgent"
```

To remove:
```powershell
sc.exe stop "RemoteIQAgent"
sc.exe delete "RemoteIQAgent"
```

## Configuration

Edit `appsettings.json` or set env vars:
- `AGENT_API_BASE` (default `http://localhost:3001`)
- `ENROLLMENT_SECRET` (default from appsettings)

## Security

- Token stored under `%ProgramData%\RemoteIQ\agent.json` with ACLs restricted to SYSTEM and Administrators.
- HTTP only allowed to `http://localhost:*` for dev; otherwise HTTPS with valid cert.
- Update binaries must match the SHA256 announced by the backend.
