import { Component } from '@angular/core';
import { WebSocketSubject } from 'rxjs/webSocket';
import { finalize } from 'rxjs/operators';

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
  sentVote = false;
  result: string;

  private socket: WebSocketSubject<any>;

  constructor() {}

  get connected() {
    return this.socket && !this.socket.closed;
  }

  ping() {
    this.socket.next('ping');
  }

  enterRoom() {
    const url = new URL('ws://localhost:3000/ws');

    url.host = location.host;
    url.port = location.port;

    if (this.userName) {
      url.searchParams.set('name', this.userName);
    }

    if (this.socket && !this.socket.closed) {
      this.socket.complete();
    }

    this.socket = new WebSocketSubject({
      url: url.toString(),
      deserializer: e => e.data,
      serializer: e => e
    });

    setTimeout(() => {
      this.socket.pipe(
        finalize(() => this.socket = null)
      ).subscribe(
          msg => this.messageHandler(msg),
          console.error
      );
    }, 100);
  }

  messageHandler(message: string): void {
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
      msg = msg.slice(9)
      if (msg.startsWith('start')) {
        this.ongoing = true;
      } else if (msg.startsWith('end')) {
        this.ongoing = false;
        this.sentVote = false;

        if (this.userRole === 'admin') {
          this.result = msg.slice(4)
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
    this.sentVote = true;
  }

  private setName(name: string) {
    this.userName = name;
  }

  private setRole(role: string) {
    this.userRole = role;
  }
}
