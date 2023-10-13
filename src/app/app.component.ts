import { Component } from '@angular/core';
import { FormControl } from '@angular/forms';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { YtbService } from './ytb.service';

declare var $: any;

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.less'],
})
export class AppComponent {
  title = 'Cats Love Youtube';

  videoUrlCtrl = new FormControl();
  invalidUrl = false;
  inFullscreen = false;
  playingVideoOfParam = false;

  bullets = [];

  suggestions_xs = [
    {
      videoId: 'o_XVt5rdpFY',
      title: 'The secrets of learning a new language | Lýdia Machová',
    },
    {
      playlistId: 'PL30C13C91CFFEFEA6',
      url: 'https://www.youtube.com/watch?v=kBdfcR-8hEY&list=PL30C13C91CFFEFEA6&index=1&ab_channel=HarvardUniversity',
      img: 'https://pnlpal.dev/assets/uploads/files/1608889019866-9bbd99c2-3fed-4fcf-9ba5-f25f027cec5d-image.png',
      title: "Justice: What's The Right Thing To Do?",
    },
  ];
  suggestions = [
    {
      videoId: 'IZ3XMOdOdKM',
      title: 'Miley Cyrus - Used To Be Young (Official Video)',
    },
    {
      videoId: 'g0Q5YeZ4YOA',
      title: 'Why is the world warming up? | Kristen Bell + Giant Ant',
    },
    {
      videoId: 'o_XVt5rdpFY',
      title: 'The secrets of learning a new language | Lýdia Machová',
    },
    {
      videoId: 'GfO-3Oir-qM',
      title: 'Our Planet | One Planet | FULL EPISODE | Netflix',
    },
    {
      playlistId: 'PL30C13C91CFFEFEA6',
      url: 'https://www.youtube.com/watch?v=kBdfcR-8hEY&list=PL30C13C91CFFEFEA6&index=1&ab_channel=HarvardUniversity',
      img: 'https://pnlpal.dev/assets/uploads/files/1608889019866-9bbd99c2-3fed-4fcf-9ba5-f25f027cec5d-image.png',
      title: "Justice: What's The Right Thing To Do?",
    },
    {
      videoId: 'lUUte2o2Sn8',
      title: "Gil Strang's Final 18.06 Linear Algebra Lecture",
    },
  ];

  constructor(private ytb: YtbService) {
    const parseParams = (search: string) => {
      const parameters = new URLSearchParams(search);
      const link = parameters.get('link');
      if (link) {
        this.ytb.playLink = link;
        return this.ytb.parseUrl(link.trim());
      } else {
        const videoId = parameters.get('v');
        const playlistId = parameters.get('list');
        const indexInPlaylist = parseInt(parameters.get('index')) - 1;

        return { playlistId, indexInPlaylist, videoId };
      }
    };

    const parsed = parseParams(window.location.search);
    if (this.ytb.saveLast(parsed)) {
      this.playingVideoOfParam = true;
    } else {
      try {
        const parsedTop = parseParams(window.top.location.search);
        // console.log('Parsed params from top window url: ', parsedTop);
        this.ytb.saveLast(parsedTop);
      } catch (error) {
        // iframe is in another domain;
        console.warn(error);
      }
    }
  }

  ngOnInit() {
    this.videoUrlCtrl.valueChanges
      .pipe(debounceTime(500), distinctUntilChanged())
      .subscribe((url: string) => {
        this.invalidUrl = false;
        this.ytb.playLink = url;
        // console.log('videoUrlCtrl change: ', url);

        const parsed = this.ytb.parseUrl(url.trim());
        if (parsed.playlistId)
          this.ytb.loadPlaylistById(parsed.playlistId, parsed.indexInPlaylist);
        else if (parsed.videoId) this.ytb.loadVideoById(parsed.videoId);
        else if (url.trim()) {
          this.invalidUrl = true;
          this.ytb.playLink = '';
        }
      });

    document.addEventListener('fullscreenchange', () => {
      if (document.fullscreenElement) {
        // fullscreen is activated
        this.inFullscreen = true;
      } else {
        // fullscreen is cancelled
        this.inFullscreen = false;
      }
    });

    let timer_ = null;
    clearInterval(timer_);
    timer_ = setInterval(() => {
      this.bullets = this.ytb.bullets;
    }, 500);
  }
  openSuggestion(s) {
    if (s.playlistId) this.ytb.loadPlaylistById(s.playlistId);
    else this.ytb.loadVideoById(s.videoId);
  }
  openShares() {
    $('app-shares .modal').modal('show');
  }
}
