import { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";

const socket = io("http://localhost:5000");

function App() {
  const [username, setUsername] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [typingUser, setTypingUser] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [unreadUsers, setUnreadUsers] = useState({});

  const usernameRef = useRef("");
  const selectedUserRef = useRef(null);

  // =========================
  // LOAD MESSAGE HISTORY
  // =========================

  useEffect(() => {
    fetch("http://localhost:5000/messages")
      .then((res) => {
        if (!res.ok) {
          throw new Error("Failed to fetch messages");
        }

        return res.json();
      })
      .then((data) => {
        setMessages(data);
      })
      .catch((error) => {
        console.error("History error:", error);
      });
  }, []);

  // =========================
  // SOCKET EVENTS
  // =========================

  useEffect(() => {
    const handleReceiveMessage = (newMessage) => {
      setMessages((prev) => {
        const alreadyExists = prev.some(
          (msg) => String(msg._id) === String(newMessage._id)
        );

        if (alreadyExists) {
          return prev;
        }

        return [...prev, newMessage];
      });

      const currentUsername = usernameRef.current;
      const currentSelectedUser = selectedUserRef.current;

      // Apna message hai
      if (newMessage.username === currentUsername) {
        return;
      }

      // Message mere liye nahi hai
      if (newMessage.receiver !== currentUsername) {
        return;
      }

      // Agar isi user ka chat already open hai
      if (newMessage.username === currentSelectedUser) {
        // Message immediately read mark karo
        if (newMessage._id) {
          socket.emit("read-message", newMessage._id);
        }

        return;
      }

      // Unread count +1
      setUnreadUsers((prev) => ({
        ...prev,
        [newMessage.username]:
          (prev[newMessage.username] || 0) + 1,
      }));
    };

    // =========================
    // MESSAGE STATUS
    // =========================

    const handleMessageStatus = ({ messageId, status }) => {
      setMessages((prev) =>
        prev.map((msg) =>
          String(msg._id) === String(messageId)
            ? {
                ...msg,
                status: status,
              }
            : msg
        )
      );
    };

    // =========================
    // ONLINE USERS
    // =========================

    const handleOnlineUsers = (users) => {
      setOnlineUsers(users);
    };

    // =========================
    // TYPING
    // =========================

    const handleTyping = (user) => {
      if (user !== usernameRef.current) {
        setTypingUser(user);
      }
    };

    const handleStopTyping = () => {
      setTypingUser("");
    };

    // =========================
    // MESSAGE ERROR
    // =========================

    const handleMessageError = (error) => {
      console.error("Message error:", error.message);
    };

    socket.on(
      "receive-message",
      handleReceiveMessage
    );

    socket.on(
      "message-status",
      handleMessageStatus
    );

    socket.on(
      "online-users",
      handleOnlineUsers
    );

    socket.on(
      "user-typing",
      handleTyping
    );

    socket.on(
      "user-stop-typing",
      handleStopTyping
    );

    socket.on(
      "message-error",
      handleMessageError
    );

    return () => {
      socket.off(
        "receive-message",
        handleReceiveMessage
      );

      socket.off(
        "message-status",
        handleMessageStatus
      );

      socket.off(
        "online-users",
        handleOnlineUsers
      );

      socket.off(
        "user-typing",
        handleTyping
      );

      socket.off(
        "user-stop-typing",
        handleStopTyping
      );

      socket.off(
        "message-error",
        handleMessageError
      );
    };
  }, []);

  // =========================
  // LOGIN
  // =========================

  const handleLogin = (e) => {
    e.preventDefault();

    if (!username.trim()) return;

    const cleanUsername = username.trim();

    usernameRef.current = cleanUsername;
    selectedUserRef.current = null;

    if (!socket.connected) {
      socket.connect();
    }

    socket.emit("join", cleanUsername);

    setUsername(cleanUsername);
    setSelectedUser(null);
    setLoggedIn(true);
  };

  // =========================
  // LOGOUT
  // =========================

  const handleLogout = () => {
    socket.disconnect();

    usernameRef.current = "";
    selectedUserRef.current = null;

    setUsername("");
    setLoggedIn(false);
    setSelectedUser(null);
    setMessages([]);
    setOnlineUsers([]);
    setTypingUser("");
    setMessage("");
    setUnreadUsers({});
  };

  // =========================
  // SELECT USER
  // =========================

  const handleSelectUser = (user) => {
    selectedUserRef.current = user;

    setSelectedUser(user);

    // Unread count zero
    setUnreadUsers((prev) => ({
      ...prev,
      [user]: 0,
    }));

    // Is user ke unread messages ko read mark karo
    setMessages((prevMessages) => {
      prevMessages.forEach((msg) => {
        if (
          msg.username === user &&
          msg.receiver === username &&
          msg.status !== "read" &&
          msg._id &&
          !String(msg._id).startsWith("temp-")
        ) {
          socket.emit(
            "read-message",
            msg._id
          );
        }
      });

      return prevMessages;
    });
  };

  // =========================
  // SEND MESSAGE
  // =========================

  const handleSendMessage = (e) => {
    e.preventDefault();

    const text = message.trim();

    if (!text) return;

    if (!selectedUser) {
      alert("Please select a user first.");
      return;
    }

    // Temporary message
    // Sender ke chat me instantly dikhega
    const temporaryMessage = {
      _id: `temp-${Date.now()}`,
      username: username,
      text: text,
      receiver: selectedUser,
      status: "sent",
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [
      ...prev,
      temporaryMessage,
    ]);

    // Server ko message bhejo
    socket.emit("send-message", {
      username: username,
      text: text,
      receiver: selectedUser,
    });

    socket.emit(
      "stop-typing",
      username
    );

    setMessage("");
  };

  // =========================
  // LOGIN SCREEN
  // =========================

  if (!loggedIn) {
    return (
      <div className="min-h-screen bg-[#0b0d10] text-white flex items-center justify-center">
        <div className="w-full max-w-[420px] px-6">

          <div className="mb-10">

            <div className="flex items-center gap-3 mb-8">

              <div className="w-9 h-9 rounded-lg bg-white text-black flex items-center justify-center font-bold">
                V
              </div>

              <span className="text-xl font-semibold">
                Vynk
              </span>

            </div>

            <h1 className="text-3xl font-semibold">
              Welcome back.
            </h1>

            <p className="text-[#8b9099] mt-2 text-[15px]">
              Enter a username to start chatting.
            </p>

          </div>

          <form onSubmit={handleLogin}>

            <label className="block text-sm text-[#b8bdc7] mb-2">
              Username
            </label>

            <input
              type="text"
              placeholder="e.g. reyansh"
              value={username}
              onChange={(e) =>
                setUsername(e.target.value)
              }
              className="w-full h-12 px-4 bg-[#14171c] border border-[#292d34] rounded-lg text-white placeholder:text-[#5f6570] outline-none focus:border-[#555b66]"
            />

            <button
              type="submit"
              className="w-full h-12 mt-4 bg-white text-black rounded-lg font-medium hover:bg-[#e8e8e8] transition"
            >
              Continue
            </button>

          </form>

          <div className="mt-10 pt-5 border-t border-[#1d2025]">

            <p className="text-xs text-[#5f6570]">
              Vynk · Real-time messaging
            </p>

          </div>

        </div>
      </div>
    );
  }

  // =========================
  // CHAT SCREEN
  // =========================

  return (
    <div className="h-screen bg-[#0b0d10] text-white flex overflow-hidden">

      {/* SIDEBAR */}

      <aside className="w-[280px] border-r border-[#1d2025] bg-[#0f1115] flex flex-col">

        <div className="h-16 px-5 border-b border-[#1d2025] flex items-center justify-between">

          <div className="flex items-center gap-2">

            <div className="w-7 h-7 rounded-md bg-white text-black flex items-center justify-center font-bold text-sm">
              V
            </div>

            <span className="font-semibold">
              Vynk
            </span>

          </div>

          <span className="text-xs text-[#666c76]">
            {onlineUsers.length} online
          </span>

        </div>

        {/* SEARCH */}

        <div className="p-4">

          <input
            placeholder="Search conversations"
            className="w-full h-10 px-3 bg-[#171a1f] border border-[#272b32] rounded-md text-sm outline-none placeholder:text-[#666c76]"
          />

        </div>

        {/* ONLINE USERS */}

        <div className="px-3">

          <p className="text-[11px] uppercase tracking-wider text-[#666c76] px-3 mb-2">
            Online
          </p>

          {onlineUsers
            .filter((user) => user !== username)
            .map((user, index) => (

              <div
                key={`${user}-${index}`}
                onClick={() =>
                  handleSelectUser(user)
                }
                className={`flex items-center gap-3 px-3 py-3 rounded-lg mb-2 cursor-pointer transition ${
                  selectedUser === user
                    ? "bg-[#252930]"
                    : "bg-[#1a1d22] hover:bg-[#202329]"
                }`}
              >

                <div className="relative">

                  <div className="w-9 h-9 rounded-full bg-[#30343b] flex items-center justify-center text-sm font-medium">
                    {user
                      .charAt(0)
                      .toUpperCase()}
                  </div>

                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-[#1a1d22] rounded-full" />

                </div>

                <div className="flex-1 min-w-0">

                  <p className="text-sm font-medium truncate">
                    {user}
                  </p>

                  <p className="text-xs text-green-500">
                    Online
                  </p>

                </div>

                {/* UNREAD COUNT */}

                {unreadUsers[user] > 0 && (
                  <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-white text-black text-[10px] font-bold flex items-center justify-center">
                    {unreadUsers[user]}
                  </span>
                )}

              </div>

            ))}

          {onlineUsers.filter(
            (user) => user !== username
          ).length === 0 && (

            <p className="text-xs text-[#666c76] px-3 py-3">
              No other users online
            </p>

          )}

        </div>

        {/* CURRENT USER */}

        <div className="mt-auto p-4 border-t border-[#1d2025]">

          <div className="flex items-center justify-between gap-3">

            <div className="flex items-center gap-3">

              <div className="w-9 h-9 rounded-full bg-white text-black flex items-center justify-center text-sm font-semibold">
                {username
                  .charAt(0)
                  .toUpperCase()}
              </div>

              <div>

                <p className="text-sm font-medium">
                  {username}
                </p>

                <p className="text-xs text-green-500">
                  ● Online
                </p>

              </div>

            </div>

            <button
              onClick={handleLogout}
              className="text-xs text-[#8b9099] hover:text-white transition"
            >
              Logout
            </button>

          </div>

        </div>

      </aside>

      {/* CHAT AREA */}

      <main className="flex-1 flex flex-col">

        {/* HEADER */}

        <header className="h-16 border-b border-[#1d2025] flex items-center px-6">

          {selectedUser ? (

            <>
              <div className="w-9 h-9 rounded-full bg-[#30343b] flex items-center justify-center mr-3">
                {selectedUser
                  .charAt(0)
                  .toUpperCase()}
              </div>

              <div>

                <p className="text-sm font-medium">
                  {selectedUser}
                </p>

                <p className="text-xs text-green-500">
                  Online
                </p>

              </div>
            </>

          ) : (

            <>
              <div className="w-9 h-9 rounded-full bg-[#30343b] flex items-center justify-center mr-3">
                V
              </div>

              <div>

                <p className="text-sm font-medium">
                  Vynk Chat
                </p>

                <p className="text-xs text-[#666c76]">
                  Select someone to chat
                </p>

              </div>
            </>

          )}

        </header>

        {/* MESSAGES */}

        <div className="flex-1 overflow-y-auto p-6">

          {!selectedUser ? (

            <div className="h-full flex items-center justify-center">

              <div className="text-center">

                <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-[#171a1f] flex items-center justify-center text-xl">
                  💬
                </div>

                <h2 className="text-lg font-medium">
                  Select someone to chat
                </h2>

                <p className="text-sm text-[#666c76] mt-1">
                  Choose an online user from the sidebar.
                </p>

              </div>

            </div>

          ) : (

            (() => {
              const currentMessages =
                messages.filter((msg) => {
                  return (
                    (msg.username === username &&
                      msg.receiver === selectedUser) ||
                    (msg.username === selectedUser &&
                      msg.receiver === username)
                  );
                });

              if (currentMessages.length === 0) {
                return (
                  <div className="h-full flex items-center justify-center">

                    <div className="text-center">

                      <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-[#171a1f] flex items-center justify-center text-xl">
                        💬
                      </div>

                      <h2 className="text-lg font-medium">
                        Start a conversation
                      </h2>

                      <p className="text-sm text-[#666c76] mt-1">
                        Send a message to {selectedUser}.
                      </p>

                    </div>

                  </div>
                );
              }

              return currentMessages.map(
                (msg, index) => (

                  <div
                    key={msg._id || index}
                    className={`flex mb-4 ${
                      msg.username === username
                        ? "justify-end"
                        : "justify-start"
                    }`}
                  >

                    <div>

                      <div
                        className={
                          msg.username === username
                            ? "bg-white text-black px-4 py-3 rounded-lg max-w-md"
                            : "bg-[#181b20] border border-[#252930] px-4 py-3 rounded-lg max-w-md"
                        }
                      >

                        <p className="text-sm">
                          {msg.text}
                        </p>

                      </div>

                      <div className="text-[10px] text-[#5f6570] mt-1 flex items-center gap-1">

                        <span>
                          {msg.username} •{" "}
                          {new Date(
                            msg.createdAt
                          ).toLocaleTimeString(
                            [],
                            {
                              hour: "2-digit",
                              minute: "2-digit",
                            }
                          )}
                        </span>

                        {/* MESSAGE STATUS */}

                        {msg.username === username && (
                          <span
                            className={
                              msg.status === "read"
                                ? "text-blue-500 font-semibold"
                                : "text-[#777d87]"
                            }
                          >
                            {msg.status === "sent"
                              ? "✓"
                              : "✓✓"}
                          </span>
                        )}

                      </div>

                    </div>

                  </div>

                )
              );
            })()

          )}

        </div>

        {/* TYPING */}

        {typingUser &&
          typingUser !== username &&
          selectedUser === typingUser && (

            <div className="px-6 pb-2 text-xs text-[#666c76]">
              {typingUser} is typing...
            </div>

          )}

        {/* INPUT */}

        <div className="p-4 border-t border-[#1d2025]">

          <form
            onSubmit={handleSendMessage}
            className="flex gap-3"
          >

            <input
              value={message}
              disabled={!selectedUser}
              onChange={(e) => {

                const value =
                  e.target.value;

                setMessage(value);

                if (!selectedUser) {
                  return;
                }

                if (value.trim()) {
                  socket.emit(
                    "typing",
                    username
                  );
                } else {
                  socket.emit(
                    "stop-typing",
                    username
                  );
                }

              }}
              placeholder={
                selectedUser
                  ? `Message ${selectedUser}...`
                  : "Select someone first..."
              }
              className="flex-1 h-11 px-4 bg-[#14171c] border border-[#292d32] rounded-lg text-sm outline-none placeholder:text-[#666c76] focus:border-[#555b66] disabled:opacity-50"
            />

            <button
              type="submit"
              disabled={!selectedUser}
              className="px-5 h-11 bg-white text-black rounded-lg font-medium text-sm hover:bg-[#e8e8e8] transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Send
            </button>

          </form>

        </div>

      </main>

    </div>
  );
}

export default App;