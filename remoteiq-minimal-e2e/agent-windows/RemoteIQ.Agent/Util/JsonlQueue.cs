using System.Text.Json;

namespace RemoteIQ.Agent.Util;

public class JsonlQueue
{
    private readonly string _dir;
    private readonly object _lock = new();

    public JsonlQueue()
    {
        _dir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "RemoteIQ", "queue");
        Directory.CreateDirectory(_dir);
    }

    public void Enqueue(string type, object payload)
    {
        var line = JsonSerializer.Serialize(new QueueItem { Type = type, Payload = payload, Ts = DateTime.UtcNow });
        var file = Path.Combine(_dir, $"{DateTime.UtcNow:yyyyMMddHHmmssfff}-{Guid.NewGuid():N}.jsonl");
        lock (_lock)
        {
            File.WriteAllText(file, line);
        }
    }

    public IEnumerable<QueueItem> Drain()
    {
        var files = Directory.EnumerateFiles(_dir, "*.jsonl").OrderBy(f => f).ToList();
        foreach (var f in files)
        {
            QueueItem? item = null;
            try
            {
                var line = File.ReadAllText(f);
                item = JsonSerializer.Deserialize<QueueItem>(line);
            }
            catch { }
            finally
            {
                try { File.Delete(f); } catch { }
            }
            if (item != null) yield return item!;
        }
    }

    public class QueueItem
    {
        public string Type { get; set; } = "";
        public object? Payload { get; set; }
        public DateTime Ts { get; set; }
    }
}
