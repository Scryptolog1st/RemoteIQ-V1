namespace RemoteIQ.Agent.Models;

public sealed class TaskEnvelope
{
    public string TaskId { get; set; } = "";
    public string Type { get; set; } = "";
    public string PayloadBase64 { get; set; } = "";
    public string? SignatureBase64 { get; set; } = null;
}

public sealed class TaskResult
{
    public string TaskId { get; set; } = "";
    public int ExitCode { get; set; }
    public string StdoutBase64 { get; set; } = "";
    public string StderrBase64 { get; set; } = "";
    public long DurationMs { get; set; }
}
