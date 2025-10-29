// remoteiq-minimal-e2e/agent-windows/RemoteIQ.Agent/Models/Contracts.cs
using System;
using System.Collections.Generic;

namespace RemoteIQ.Agent.Models
{
    // ----- Enrollment -----
    // Backend expects: { enrollmentSecret, deviceId, hostname, os, arch, version }
    public record EnrollRequest(
        string EnrollmentSecret,
        string DeviceId,
        string Hostname,
        string Os,
        string Arch,
        string Version
    );

    public record EnrollResponse(
        string AgentId,
        string AgentToken,
        DateTime? RotateAfter
    );

    // ----- Ping (facts) -----
    // Sent by agent to /api/agent/ping (auth via Agent token)
    public record PingRequest(
        string? Os,
        string? Arch,
        string? Version,
        string? PrimaryIp,
        string? User
    );

    // ====== Legacy / future types (kept for later features) ======

    // OS/Agent info shapes you might reuse later for richer inventory
    public record OsInfo(string Family, string Edition, string Version, string Build, string Arch);
    public record AgentInfo(string Version, string Platform);

    // Optional: earlier heartbeat/inventory/metrics/logs contracts.
    // Safe to keep; they’re not used by the current flow.
    public record HeartbeatRequest(
        string AgentId,
        long UptimeSec,
        List<string> IpAddrs,
        string? LastInventoryHash,
        string AgentVersion
    );

    public record InventoryRequest(
        string AgentId,
        Hardware Hardware,
        OsInfo Os,
        Network Network,
        List<SoftwareItem> Software,
        List<ServiceItem> Services,
        List<ProcessItem> Processes
    );

    public record MetricsRequest(
        string AgentId,
        DateTime SampleTs,
        double CpuPct,
        double MemPct,
        Dictionary<string, double> DiskPct,
        List<TopProcess> TopProcesses
    );

    public record LogsRequest(
        string AgentId,
        string Source,
        string Level,
        List<LogEvent> Events
    );

    public record JobFetchResponse(
        string JobId,
        string Type,
        int TimeoutSec,
        string Command
    );

    public record JobResultRequest(
        string Status,
        int ExitCode,
        string Stdout,
        string Stderr
    );

    // ----- Inventory subtypes -----
    public record Hardware(
        Cpu Cpu,
        long RamBytes,
        List<Disk> Disks,
        List<Gpu> Gpu,
        Motherboard Motherboard,
        Bios Bios
    );
    public record Cpu(string Model, int Cores, int LogicalCpus);
    public record Disk(string Name, long SizeBytes, string Type);
    public record Gpu(string Name, string? DriverVersion);
    public record Motherboard(string Manufacturer, string Product);
    public record Bios(string Vendor, string Version, string? Date);

    public record Network(List<NetIf> Interfaces);
    public record NetIf(string Name, string Mac, List<string> Ipv4, List<string> Ipv6, string? Gateway, List<string> Dns);

    public record SoftwareItem(string DisplayName, string? Version, string? Publisher, string? InstallDate);
    public record ServiceItem(string Name, string DisplayName, string Status, string StartType);
    public record ProcessItem(int Pid, string Name, double CpuPct, long MemBytes);

    // ----- Metrics / Logs -----
    public record TopProcess(int Pid, string Name, double CpuPct, long MemBytes);
    public record LogEvent(int EventId, string Provider, DateTime Time, string Message);
}
