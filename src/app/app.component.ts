import { Component, NgZone } from '@angular/core';
import { WebSocketSubject } from 'rxjs/webSocket';
import { retryWhen, delay, tap } from 'rxjs/operators';
import { serializeError } from 'serialize-error';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styles: []
})
export class AppComponent {
  title = 'scrum';
  userName: string;
  userRole = 'user';
  clientsNum = 0;
  cards = [1, 2, 3, 5, 8, 13];
  voted: string[];
  ongoing = false;
  result: string;

  private socket: WebSocketSubject<any>;

  constructor(private readonly ngZone: NgZone) {}

  get connected() {
    return this.socket && !this.socket.closed;
  }

  ping() {
    this.socket.next('ping');
  }

  enterRoom() {
    // const url = new URL('ws://localhost:3000/ws');

    // if (this.userName) {
    //   url.searchParams.set('name', this.userName);
    // }

    // if (this.socket && !this.socket.closed) {
    //   this.socket.complete();
    // }

    this.socket = new WebSocketSubject({
      url: 'ws://localhost:3000/ws',
      deserializer: e => e.data,
      serializer: e => e
    });

    setTimeout(() => {
      this.socket.subscribe(
        msg => this.messageHandler(msg),
        err => console.log(JSON.stringify(stringify_object(err))),
        () => () => this.socket = null
      );
    }, 100);
  }

  messageHandler(message: string): void {
    console.log('msg', message);
    let msg = message;

    if (msg.startsWith('set')) {
      msg = msg.slice(4);
      if (msg.startsWith('name')) {
        msg = msg.slice(5);
        this.setName(msg);
      } else if (msg.startsWith('role')) {
        msg = msg.slice(5);
        this.setRole(msg);
      }
    } else if (msg.startsWith('clients')) {
      this.clientsNum = parseInt(msg.replace('clients:', ''));
    } else if (msg.startsWith('election')) {
      msg = msg.slice(9);
      if (msg.startsWith('start')) {
        this.ongoing = true;
      } else if (msg.startsWith('end')) {
        this.ongoing = false;

        if (this.userRole === 'admin') {
          this.result = msg.slice(4);
        }
      } else if (msg.startsWith('voted')) {
        this.voted = JSON.parse(msg.slice(6));
      }
    }
  }

  start() {
    this.socket.next('election:start');
  }

  submit(card: string | number) {
    this.socket.next('card:' + card);
  }

  private setName(name: string) {
    this.userName = name;
  }

  private setRole(role: string) {
    this.userRole = role;
  }
}

function stringify_object(object, depth = 0, max_depth = 2) {
  // change max_depth to see more levels, for a touch event, 2 is good
  if (depth > max_depth) return 'Object';

  const obj = {};
  for (let key in object) {
    let value = object[key];
    if (value instanceof Node)
      // specify which properties you want to see from the node
      // @ts-ignore
      value = { id: value.id };
    else if (value instanceof Window) value = 'Window';
    else if (value instanceof Object)
      value = stringify_object(value, depth + 1, max_depth);

    obj[key] = value;
  }

  return depth ? obj : JSON.stringify(obj);
}
