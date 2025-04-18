import { format } from "date-fns";

interface Message {
  content: string;
  username: string;
  timestamp?: string;
  type: "self" | "recv";
}

interface GroupedMessage {
  username: string;
  type: "self" | "recv";
  messages: Array<{
    content: string;
    timestamp?: string;
  }>;
}

interface ChatBodyProps {
  data: Message[];
}

const ChatBody = ({ data }: ChatBodyProps) => {
  // Helper function to format timestamp
  const formatTime = (timestamp?: string): string => {
    if (!timestamp) return "";

    try {
      const date = new Date(timestamp);
      return format(date, "h:mm a");
    } catch (error) {
      console.error("Error formatting timestamp:", error);
      return "";
    }
  };

  // Group consecutive messages from the same user
  const groupedMessages: GroupedMessage[] = data.reduce((acc: GroupedMessage[], message, index) => {
    if (index === 0 || message.username !== data[index - 1].username) {
      // Start a new group
      acc.push({
        username: message.username,
        type: message.type,
        messages: [{ content: message.content, timestamp: message.timestamp }],
      });
    } else {
      // Add to the last group
      acc[acc.length - 1].messages.push({
        content: message.content,
        timestamp: message.timestamp,
      });
    }
    return acc;
  }, []);

  return (
    <div className="space-y-4">
      {groupedMessages.map((group, groupIndex) => (
        <div
          key={`group-${groupIndex}`}
          className={`flex flex-col ${
            group.type === "self" ? "items-end" : "items-start"
          }`}
        >
          <div className="text-sm font-medium mb-1 px-1">{group.username}</div>
          <div className="space-y-1 max-w-[80%]">
            {group.messages.map((msg, msgIndex) => (
              <div
                key={`msg-${groupIndex}-${msgIndex}`}
                className="flex flex-col"
              >
                <div
                  className={`px-4 py-2 rounded-lg ${
                    group.type === "self"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-200 text-gray-800"
                  }`}
                >
                  {msg.content}
                </div>
                {msg.timestamp && (
                  <div className="text-xs text-gray-500 mt-1 px-1">
                    {formatTime(msg.timestamp)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default ChatBody;