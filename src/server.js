const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const stompit = require('stompit');

// ActiveMQ message publishing
function publishToActiveMQ(msg, socketId) {
  const connectOptions = {
    host: 'localhost',
    port: 61613,
    connectHeaders: {
      host: '/',
      login: 'admin',
      passcode: 'admin',
    },
  };

  stompit.connect(connectOptions, (error, client) => {
    if (error) {
      console.error('Error connecting to ActiveMQ:', error.message);
      return;
    }

    const frame = client.send({
      destination: '/queue/chat_test',
      'content-type': 'text/plain',
    });

    const messageWithId = `[${socketId}] ${msg}`;
    frame.write(messageWithId);
    frame.end();

    client.disconnect();
  });
}

// ActiveMQ message receiving
function receiveFromActiveMQ() {
  const connectOptions = {
    host: 'localhost',
    port: 61613,
    connectHeaders: {
      host: '/',
      login: 'admin',
      passcode: 'admin',
    },
  };

  stompit.connect(connectOptions, (error, client) => {
    if (error) {
      console.error('Error connecting to ActiveMQ:', error.message);
      return;
    }

    const subscribeHeaders = {
      destination: '/queue/chat_test',
      ack: 'auto',
    };

    client.subscribe(subscribeHeaders, (error, message) => {
      if (error) {
        console.error('Error subscribing to ActiveMQ:', error.message);
        return;
      }

      message.readString('utf-8', (error, body) => {
        if (error) {
          console.error('Error reading message:', error.message);
          return;
        }

        // Emit the received message to connected clients
        io.emit('chat message', body);
      });
    });
  });
}

// Socket.IO event handlers
io.on('connection', (socket) => {
  console.log('A user connected.');

  // Handle incoming messages
  socket.on('chat message', (msg) => {
    console.log('Message:', msg);

    // Publish the message to ActiveMQ with Socket ID
    publishToActiveMQ(msg, socket.id);
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('A user disconnected.');
  });
});

// Start the server
const port = 3000;
http.listen(port, () => {
  console.log(`Server listening on port ${port}`);

  // Start receiving messages from ActiveMQ
  receiveFromActiveMQ();
});
