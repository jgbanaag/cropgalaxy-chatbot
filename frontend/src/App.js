import React, { useState, useEffect } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import './index.css';

function Chat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [threadId, setThreadId] = useState(null);
  const [loading, setLoading] = useState(false);

  // initializes chat thread
  useEffect(() => {
    axios.post('http://localhost:3001/api/thread')
      .then(res => setThreadId(res.data.threadId))
      .catch(err => console.error(err));
  }, []);

  const cleanResponse = (text) => {
    if (!text) return '';
    
    return text
      .replace(/【[\d:]+†source】/g, '')
      .replace(/<[^>]*>?/gm, '')
      
      .replace(/\n\s*\n\s*([-*•]|\d+\.)/g, '\n$1')
      .replace(/([-*•]|\d+\.)\s*\n\s*\n/g, '$1\n')
      .replace(/(\S)\n{2,}(\S)/g, '$1\n$2')
      .trim();
  };

  const handleSend = async () => {
    if (!input.trim() || !threadId) return;
    setLoading(true);
    setMessages(prev => [...prev, { sender: 'user', text: input, time: new Date() }]);
    
    try {
      const res = await axios.post('http://localhost:3001/api/message', { threadId, message: input });
      console.log('Raw API response:', res.data.response);
      const cleanedResponse = cleanResponse(res.data.response);
      console.log('Cleaned response:', cleanedResponse);
      setMessages(prev => [...prev, { sender: 'bot', text: cleanedResponse, time: new Date() }]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setInput('');
    }
  };

  return (
    <div className="website-chat-container">
      <div className="chat-header">
        <div className="header-content">
          <div className="bot-icon">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM8 17C7.45 17 7 16.55 7 16C7 15.45 7.45 15 8 15C8.55 15 9 15.45 9 16C9 16.55 8.55 17 8 17ZM9 13C9 13.55 8.55 14 8 14C7.45 14 7 13.55 7 13V11C7 10.45 7.45 10 8 10C8.55 10 9 10.45 9 11V13ZM12 18C10.34 18 9 16.66 9 15H15C15 16.66 13.66 18 12 18ZM16 14C15.45 14 15 13.55 15 13V11C15 10.45 15.45 10 16 10C16.55 10 17 10.45 17 11V13C17 13.55 16.55 14 16 14ZM16 17C15.45 17 15 16.55 15 16C15 15.45 15.45 15 16 15C16.55 15 17 15.45 17 16C17 16.55 16.55 17 16 17Z" fill="#F5F5F5"/>
            </svg>
          </div>
          <span className="chat-title">CropGalaxy Assistant</span>
        </div>
      </div>
      
      <div className="messages">
        {messages.map((msg, i) => (
          <div key={i} className={`message ${msg.sender}`}>
            <div className="message-meta">
              {msg.sender === 'bot' ? (
                <div className="sender-icon bot-icon icon-bg">
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM8 17C7.45 17 7 16.55 7 16C7 15.45 7.45 15 8 15C8.55 15 9 15.45 9 16C9 16.55 8.55 17 8 17ZM9 13C9 13.55 8.55 14 8 14C7.45 14 7 13.55 7 13V11C7 10.45 7.45 10 8 10C8.55 10 9 10.45 9 11V13ZM12 18C10.34 18 9 16.66 9 15H15C15 16.66 13.66 18 12 18ZM16 14C15.45 14 15 13.55 15 13V11C15 10.45 15.45 10 16 10C16.55 10 17 10.45 17 11V13C17 13.55 16.55 14 16 14ZM16 17C15.45 17 15 16.55 15 16C15 15.45 15.45 15 16 15C16.55 15 17 15.45 17 16C17 16.55 16.55 17 16 17Z" fill="#2c3143"/>
                  </svg>
                </div>
              ) : (
                <div className="sender-icon user-icon icon-bg">
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 5C13.66 5 15 6.34 15 8C15 9.66 13.66 11 12 11C10.34 11 9 9.66 9 8C9 6.34 10.34 5 12 5ZM12 19.2C9.5 19.2 7.29 17.92 6 15.98C6.03 13.99 10 12.9 12 12.9C13.99 12.9 17.97 13.99 18 15.98C16.71 17.92 14.5 19.2 12 19.2Z" fill="#2c3143"/>
                  </svg>
                </div>
              )}
            </div>
            <div className="message-content-wrapper">
              <div className="message-content">
                {msg.sender === 'bot' ? (
                  <ReactMarkdown components={{
                    p: ({node, ...props}) => <p style={{margin: '0.5em 0'}} {...props} />,
                    ul: ({node, ...props}) => <ul className="compact-list" {...props} />,
                    ol: ({node, ...props}) => <ol className="compact-list" {...props} />,
                    li: ({node, ...props}) => <li className="compact-item" {...props} />,
                    strong: ({node, ...props}) => <strong className="markdown-strong" {...props} />,
                    em: ({node, ...props}) => <em className="markdown-em" {...props} />,
                    root: ({node, ...props}) => <div className="markdown-root" {...props} />
                  }}>
                    {msg.text}
                  </ReactMarkdown>
                ) : (
                  msg.text
                )}
              </div>
              <div className="message-time">
                {msg.time.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
              </div>
            </div>
          </div>
        ))}
        {loading && (
          <div className="typing-indicator">
            <div className="sender-icon bot-icon icon-bg">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM8 17C7.45 17 7 16.55 7 16C7 15.45 7.45 15 8 15C8.55 15 9 15.45 9 16C9 16.55 8.55 17 8 17ZM9 13C9 13.55 8.55 14 8 14C7.45 14 7 13.55 7 13V11C7 10.45 7.45 10 8 10C8.55 10 9 10.45 9 11V13ZM12 18C10.34 18 9 16.66 9 15H15C15 16.66 13.66 18 12 18ZM16 14C15.45 14 15 13.55 15 13V11C15 10.45 15.45 10 16 10C16.55 10 17 10.45 17 11V13C17 13.55 16.55 14 16 14ZM16 17C15.45 17 15 16.55 15 16C15 15.45 15.45 15 16 15C16.55 15 17 15.45 17 16C17 16.55 16.55 17 16 17Z" fill="#2c3143"/>
              </svg>
            </div>
            <div className="typing-dots">
              <div className="typing-dot"></div>
              <div className="typing-dot"></div>
              <div className="typing-dot"></div>
            </div>
          </div>
        )}
      </div>
      
      <div className="input-area">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSend()}
          disabled={loading}
          placeholder="Ask about CropGalaxy..."
          aria-label="Type your message"
        />
        <button onClick={handleSend} disabled={loading} aria-label="Send message">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" fill={loading ? "#ccc" : "white"}/>
          </svg>
        </button>
      </div>
    </div>
  );
}

export default Chat;