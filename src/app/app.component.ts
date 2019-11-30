import { Component } from '@angular/core';
import { WebSocketSubject } from 'rxjs/webSocket';
import { finalize } from 'rxjs/operators';

@Component({
    selector: 'app-root',
    templateUrl: 'app.component.html',
    styleUrls: ['app.component.scss']
})
export class AppComponent {
    userName: string;
    userRole;
    clientsNum = 0;
    clientsList: string[];
    showClientsList = false;
    cards = [1, 2, 3, 5, 8, 13];
    voted: string[];
    ongoing = false;
    sentVote = false;
    result: string;
    min: string;
    max: string;

    private voteSound = new Audio('assets/sound.mp3');
    private socket: WebSocketSubject<any>;

    constructor() {
    }

    get connected() {
        return this.socket && !this.socket.closed;
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
            msg = msg.replace('clients:', '');
            const dividerI = msg.indexOf(':');
            const clientsNum = msg.slice(0, dividerI);
            const clients = msg.slice(dividerI + 1);
            this.clientsNum = parseInt(clientsNum);
            this.clientsList = JSON.parse(clients);
        } else if (msg.startsWith('election')) {
            msg = msg.slice(9);
            if (msg.startsWith('start')) {
                this.onElectionStart();
            } else if (msg.startsWith('end')) {
                this.onElectionEnd();

                if (this.userRole === 'admin') {
                    const [res, min, max] = msg.slice(4).split(':');
                    this.result = res;
                    this.min = min;
                    this.max = max;
                }
            } else if (msg.startsWith('voted')) {
                this.voted = JSON.parse(msg.slice(6));
            }
        }
    }

    start() {
        this.result = null;
        this.voted = [];
        this.socket.next('election:start');
    }

    submit(card: string | number) {
        this.socket.next('card:' + card);
        this.sentVote = true;
    }

    giveAdmin(name: string) {
        if (this.userRole !== 'admin' || !confirm(`Give admin rights to ${name}?`)) {
            return;
        }

        this.socket.next('set:admin:' + JSON.stringify(name));
        this.showClientsList = false;
    }

    private setName(name: string) {
        this.userName = name;
    }

    private setRole(role: string) {
        this.userRole = role;
    }

    private onElectionStart() {
        this.ongoing = true;
        this.play();
    }

    private onElectionEnd() {
        this.ongoing = false;
        this.sentVote = false;
        this.stop();
    }

    private play() {
        this.voteSound.play();
    }

    private stop() {
        this.voteSound.pause();
        this.voteSound.currentTime = 0;
    }
}
