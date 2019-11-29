const express = require('express');
const cors = require('cors');
const app = express();
const expressWs = require('express-ws')(app);
const port = process.env.PORT || 3000;
const www = process.env.WWW || './dist/scrum';
const wss = expressWs.getWss();
const ips = require('./ip');

app.use(
  cors({
    origin: false
  })
);
app.use(express.static(www));

console.log(`serving ${www}`);

app.get('/', (req, res) => {
  res.sendFile('index.html', { root: www });
});

/*
user connects
clients set icreases
client sends "start"
election starts
all clients get "countdown"
on count "0" election ends
---
other users may send a number only once (use map)
on timeout or on all votes got election ends either
---
election ends with all clients received: off
*/

// client - role. First one is always admin
let counter = 1;
let electionTimeout;
const clients = new Map();
const electionResults = new Map();

wss.on('error', deleteClient);

// websocket route def
app.ws('/ws', (ws, req) => {
  addUser(ws, req.query.name);

  ws.on('close', () => deleteClient(ws));
  ws.on('error', () => deleteClient(ws));

  ws.on('message', msg => {
    if (msg === 'election:start' && clients.get(ws).role === 'admin') {
      startElection();
    } else if (msg === 'election:end' && clients.get(ws).role === 'admin') {
      startElection();
    } else if (msg.startsWith('card:')) {
      addVote(msg.slice(5));
    }
  });
});

app.listen(port, () => {
  console.log(`listening on http://localhost:${port}`);
  console.log('============>');
  console.log('Available at>');
  ips().forEach(e => console.log(e));
});

/** Notifies clients about changes in room size */
function notifyClientsAmount() {
  console.log('Connected:', wss.clients.size);
  wss.clients.forEach(client => client.send(`clients:` + wss.clients.size));
}

/**
 * Adds user to a clients base
 * @param {WebSocket} ws WebSocket obj
 * @param {string} name Username
 */
function addUser(ws, name) {
  const clientsSize = clients.size;
  const user = {
    role: 'user',
    name: name || 'Zorro #' + counter++
  };

  if (clientsSize === 0) {
    user.role = 'admin';
  }

  clients.set(ws, user);
  notifyClientsAmount();
  ws.send('set:name:' + user.name);
  ws.send('set:role:' + user.role);
}

/**
 * Delete client
 * @param {WebSocket} ws WebSocket obj
 */
function deleteClient(ws) {
  if (clients.has(ws)) {
    clients.delete(ws);
  }
  notifyClientsAmount();
}

function startElection() {
  clearTimeout(electionTimeout);
  electionResults.clear();

  wss.clients.forEach(client => client.send('election:start'));

  electionTimeout = setTimeout(() => {
    endElection();
  }, 20000);
}

function endElection() {
  clearTimeout(electionTimeout);

  wss.clients.forEach(client => {
    if (clients.get(client).role === 'admin') {
      let total = 0;

      electionResults.forEach(e => (count += e));

      client.send(
        'election:end:' +
          (electionResults.size > 0 ? total / electionResults.size : 0)
      );
    } else {
      client.send('election:end');
    }
  });

  electionResults.clear();
}

function notifyElectionLeft() {
  let admin;

  for (let entry of clients) {
    if (entry[1].role === 'admin') {
      admin = entry[0];
      break;
    }
  }

  const voted = [];

  wss.clients.forEach(client => {
    if (client === admin) {
      return;
    }

    if (electionResults.has(client)) {
      voted.push(clients.get(client).name);
    }
  });

  admin.send('election:voted:' + JSON.stringify(voted));
}

function addVote(ws, vote) {
  electionResults.set(ws, vote);

  if (wss.clients.size - 1 === electionResults.size) {
    endElection();
  } else {
    notifyElectionLeft();
  }
}
