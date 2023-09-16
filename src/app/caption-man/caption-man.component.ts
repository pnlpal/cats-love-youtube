import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { YtbService } from '../ytb.service';
import { FormControl } from '@angular/forms';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import * as io from 'socket.io-client';

declare var $: any;
declare var ResizeObserver: any;

const lineDuration = 10; // seconds
let lineYposTracker = 0;

@Component({
  selector: 'app-caption-man',
  templateUrl: './caption-man.component.html',
  styleUrls: ['./caption-man.component.less'],
})
export class CaptionManComponent implements OnInit {
  captionTracks = [];
  captionLines2 = [];
  originalCaptionLines2 = [];
  selectedTracks = [];
  trackName = '';

  lines = [];

  currentTab = localStorage.getItem('last-man-tab') || 'CAPTION';

  username = localStorage.username || '';
  usernameCtrl = new FormControl();
  invalidUsername = false;
  registerred = !!localStorage.username;

  commentCtrl = new FormControl();
  currentComment = '';

  socket = null;
  asyncSend = null;

  repeatA: number;
  repeatB: number;

  currentVid = '';
  currentTime = 0;
  currentLine = null;
  currentLineNum = 0;
  currentLineTimer = null;
  defaultLanguages = [];
  loading = true;

  Math = Math;

  error = null;

  currentLineTop = 0;
  settings = {
    darkMode: false,
    timestamp: false,
    fontSize: 16,
  };

  openedShareBefore = false;
  playerHeight = 0;

  asciiCat = '';

  constructor(private ytb: YtbService, private cd: ChangeDetectorRef) {
    if (localStorage.getItem('captionz-settings'))
      this.settings = JSON.parse(localStorage.getItem('captionz-settings'));
  }

  reset() {
    this.lines = [];

    this.captionTracks = [];
    this.captionLines2 = [];
    this.originalCaptionLines2 = [];
    this.selectedTracks = [];
    this.trackName = '';

    this.repeatA = NaN;
    this.repeatB = NaN;

    if (this.currentLineTimer) clearTimeout(this.currentLineTimer);
    this.currentLineTimer = null;

    this.currentLine = null;
    this.currentLineNum = 0;
    this.loading = true;
    this.error = null;
  }

  ngOnInit(): void {
    this.usernameCtrl.valueChanges
      .pipe(debounceTime(200), distinctUntilChanged())
      .subscribe((username: string) => {
        this.invalidUsername = false;
        this.username = username;
      });

    this.commentCtrl.valueChanges
      .pipe(debounceTime(200), distinctUntilChanged())
      .subscribe((comment: string) => {
        this.currentComment = comment;
      });

    const socketUri =
      location.hostname === 'localhost'
        ? `${location.hostname}:3000/`
        : `${location.hostname}/`;
    this.socket = io.connect(socketUri, { path: '/cats-love-youtube-socket' });
    (window as any).socket = this.socket;
    this.socket.on('connect', () => {
      if (this.currentVid) {
        this.socket.emit('joinRoom', {
          videoId: this.currentVid,
          manTab: this.currentTab,
        });
        this.getData();
      }
    });
    this.socket.on('welcome', ({ asciiCat }) => (this.asciiCat = asciiCat));
    this.socket.on('comment', (comment) => {
      console.log('received comment: ', comment?.text);
      if (comment?.videoId === this.currentVid) {
        this.insertComment(comment);
      }
    });
    this.socket.on('registerred', (username) => {
      this.username = username;
      localStorage.username = username;
      this.registerred = true;
    });

    this.socket.on('error', (err) => {
      this.error = err;
    });

    this.asyncSend = (message, data) =>
      new Promise((resolve) => {
        this.socket.emit(message, data, resolve);
      });

    this.initYtb();
  }

  register() {
    console.log('register user: ', this.username);

    if (!this.registerred && this.username) {
      this.socket.emit('register', {
        username: this.username,
        videoId: this.currentVid,
      });
    }
  }

  comment() {
    console.log('comment: ', this.currentComment);
    if (!this.currentComment) return;

    const comment = {
      start: this.ytb.getCurrentTime() || 0,
      text: this.currentComment,
      username: this.username,
      videoId: this.currentVid,
    };

    this.socket.emit('message', comment);

    this.currentComment = '';
    this.commentCtrl.setValue('');
  }
  insertComment(comment) {
    const insertIdx = this.lines.findIndex(
      (line) => line.start > comment.start
    );
    if (insertIdx > -1) {
      this.lines.splice(insertIdx, 0, comment);
    } else {
      this.lines.push(comment);
    }
  }

  isSmallScreen() {
    return window.innerWidth < 768;
  }

  genCaption2(newCaptions) {
    this.originalCaptionLines2 = newCaptions;
    this.captionLines2 = [];
    if (newCaptions.length === 0) return;

    let j: number = 0;

    const pushSameLines = (l: any, i: number) => {
      let l_next = this.lines[i + 1];
      let l2 = newCaptions[j];
      if (!l2) return;

      if (!this.captionLines2[i]) this.captionLines2[i] = { texts: [] };

      if (l2.start <= l.start) {
        this.captionLines2[i].texts.push(l2.text);
        j += 1;
        pushSameLines(l, i);
      } else if (l2.start < l.start + l.dur) {
        if (!l_next || l2.start + l2.dur < l_next.start + l_next.dur / 2) {
          this.captionLines2[i].texts.push(l2.text);
          j += 1;
          pushSameLines(l, i);
        }
      } else {
        if (l_next && l2.start + l2.dur < l_next.start) {
          this.captionLines2[i].texts.push(l2.text);
          j += 1;
          pushSameLines(l, i);
        }
      }
    };
    this.lines.forEach((l, i) => {
      pushSameLines(l, i);
    });

    for (let index = j; index < newCaptions.length; index++) {
      this.captionLines2.push({ texts: [newCaptions[index].text] });
    }
  }

  async changeCaption(event, track) {
    if (!track?.languageCode) {
      return;
    }

    const idx = this.selectedTracks.findIndex(
      (t) => t.languageCode === track.languageCode
    );
    if (idx >= 0) {
      this.selectedTracks.splice(idx, 1);
      if (idx === 0) {
        this.lines = this.originalCaptionLines2;
      }
      this.genCaption2([]);
    } else {
      this.loading = true;
      const videoId = this.currentVid;

      const captions = await this.asyncSend('getCaption', {
        videoId,
        languageCode: track.languageCode,
      }).then(({ xml }) => {
        return $(xml)
          .find('text')
          .toArray()
          .map((item) => {
            const start = Number.parseFloat(item.getAttribute('start'));
            const dur = Number.parseFloat(item.getAttribute('dur'));
            const text = item.innerHTML;
            return { start, dur, text };
          });
      });

      if (videoId !== this.currentVid) return;

      if (
        event &&
        event.target.nodeName !== 'INPUT' &&
        this.selectedTracks.length
      ) {
        // replace the track
        this.selectedTracks[this.selectedTracks.length - 1] = track;
      } else {
        this.selectedTracks.push(track);
      }

      if (this.selectedTracks.length === 3) {
        this.selectedTracks.splice(0, 1);
        this.lines = this.originalCaptionLines2;
        this.genCaption2(captions);
      } else if (this.selectedTracks.length === 2) {
        this.genCaption2(captions);
      } else {
        this.lines = captions;
      }
    }

    if (event) {
      this.defaultLanguages = this.selectedTracks.map((t) => t.languageName);
      localStorage.setItem(
        'last-language-names',
        JSON.stringify(this.defaultLanguages)
      );
    }

    this.trackName = this.selectedTracks.map((t) => t.languageName).join(', ');
    this.loading = false;
  }

  fullscreen() {
    const $el = $('#ytb-player-container .fullscreen-wrapper');
    if ($el.hasClass('in-fullscreen')) {
      document.exitFullscreen();
    } else {
      $el[0].requestFullscreen();
    }
  }

  async getData() {
    if (this.currentTab === 'COMMENT' && !this.lines.length) {
      this.lines = await this.asyncSend('getComments', {
        videoId: this.currentVid,
      });
      this.loading = false;
    } else if (this.currentTab === 'CAPTION' && !this.captionTracks.length) {
      this.captionTracks = await this.asyncSend('getCaptionTracks', {
        videoId: this.currentVid,
      });

      this.defaultLanguages = (() => {
        try {
          return JSON.parse(localStorage.getItem('last-language-names') || '');
        } catch (error) {
          return ['English'];
        }
      })();

      for (const name of this.defaultLanguages) {
        const track = this.captionTracks.find((x) => (x.languageName = name));
        if (track) {
          await this.changeCaption(null, track);
        }
      }
      if (!this.lines.length) {
        const defaultTrack =
          this.captionTracks.find((x) => x.languageName === 'English') ||
          this.captionTracks.find((x) => x.languageName === 'Spanish') ||
          this.captionTracks.find((x) => x.languageName === 'Japanese') ||
          this.captionTracks.find((x) => x.languageName === 'Chinese') ||
          this.captionTracks[0];
        await this.changeCaption(null, defaultTrack);
      }
    }
  }

  async initYtb() {
    this.ytb.videoId.subscribe(async (vid) => {
      console.log('video id: ', vid);
      if (!vid) return;
      this.currentVid = vid;
      this.reset();

      this.socket.emit('joinRoom', { videoId: vid, manTab: this.currentTab });
      this.getData();
    });

    await this.ytb.init();

    const setCaptionsHeight = () => {
      this.playerHeight = $('#ytb-player').height();
      const h = $('#ytb-player').height() - 100;
      $('ul.caption-ul').css('height', `${h}px`);
      if (!this.isSmallScreen()) this.currentLineTop = (h * 2) / 5;
    };

    setCaptionsHeight();
    new ResizeObserver(setCaptionsHeight).observe($('#ytb-player')[0]);
    this.changeFontSize(this.settings.fontSize);

    this.ytb.onPlaying = (t: number) => {
      if (this.lines.length) {
        console.log('on playing: ', t);
        this.scrollToTime(t);

        this.lines.forEach((line) => {
          const diff = t - line.start;
          if (line.start < t && diff < lineDuration) {
            if (!line.yPos) {
              line.yPos = lineYposTracker + 1;
              const topPercent =
                ((line.yPos - 1) % 10) * 10 + Math.floor((line.yPos - 1) / 10);
              line.top = (this.playerHeight - 50) * topPercent * 0.01 + 'px';
              this.ytb.bullets.push(line);
              lineYposTracker += 1;
            }
          } else if (line.yPos) {
            const delIdx = this.ytb.bullets.findIndex((b) => b === line);
            delete line.yPos;
            this.ytb.bullets.splice(delIdx, 1);
          }
        });
      }
    };
    this.ytb.onPaused = () => {
      clearTimeout(this.currentLineTimer);
      this.currentLineTimer = null;

      if (!this.openedShareBefore && !this.isSmallScreen()) {
        setTimeout(() => {
          $('app-shares .modal').modal('show');
        }, 2000);
        this.openedShareBefore = true;
      }
    };
  }

  setLineTimer() {
    clearTimeout(this.currentLineTimer);

    const repeatLastLine = this.currentLineNum === this.repeatB;

    let sec = this.currentLine.start + lineDuration - this.currentTime + 0.1;
    if (sec < 0.1) sec = 0.1;

    let nextLine = this.lines[this.currentLineNum + 1];
    if (nextLine && !repeatLastLine) {
      sec += (nextLine.start - (this.currentLine.start + lineDuration)) / 2;
      // console.log(`current: ${this.currentTime}, start: ${this.currentLine.start}, dur: ${this.currentLine.dur}, wait: ${sec}`);
    } else if (!nextLine && !repeatLastLine) {
      console.log(`End of line, current: ${this.currentTime}`);
      this.currentLineTimer = null;
      return;
    }

    this.currentLineTimer = setTimeout(() => {
      if (this.currentLineNum === this.repeatB) {
        // in repeat
        this.seekToLine(this.repeatA);
      } else {
        this.scrollToTime(this.ytb.getCurrentTime());
      }
    }, sec * 1000);
  }
  scrollToLine(idx) {
    if (this.currentLineNum >= 0) {
      $(
        `ul.caption-ul .list-group-item[data-index="${this.currentLineNum}"]`
      ).removeClass('active');
    }

    this.currentLine = this.lines[idx];
    this.currentLineNum = idx;

    if (this.currentLine) {
      // console.log(this.currentLine.text);
      if (this.ytb.playing) this.setLineTimer();

      if (this.repeatB >= 0 && !this.isLineInRepeat(this.currentLineNum)) {
        this.clearRepeat();
        this.cd.detectChanges(); // somehow, the changed didn't auto detected.
      }

      const $el = $(
        `ul.caption-ul .list-group-item[data-index="${this.currentLineNum}"]`
      );
      $el.addClass('active');
      const el = $el[0];
      if (el) {
        $('ul.caption-ul').scrollTop(el.offsetTop - this.currentLineTop);
      }
    }
  }
  scrollToTime(time: number) {
    const isLineInTime = (line, nextL) => {
      if (time < line.start) {
        return true;
        // within 1 seconds
      } else if (time >= line.start && time <= line.start + 1) {
        return true;
      } else if (nextL && time >= line.start && time < nextL.start) {
        return true;
      } else if (!nextL) {
        return true;
      }
      return false;
    };

    this.currentTime = time;
    const idx = this.lines.findIndex((l, i) =>
      isLineInTime(l, this.lines[i + 1])
    );
    if (idx > -1) this.scrollToLine(idx);
  }

  seekToLine(i) {
    const line = this.lines[i];
    this.ytb.seekTo(line.start);

    this.currentTime = line.start;
    this.scrollToLine(i);
  }

  clearRepeat() {
    this.repeatA = NaN;
    this.repeatB = NaN;
  }
  isLineInRepeat(i) {
    return (
      this.repeatA >= 0 &&
      this.repeatB >= 0 &&
      i >= this.repeatA &&
      i <= this.repeatB
    );
  }
  getRepeatLetter(i) {
    if (i === this.repeatB && this.repeatA !== this.repeatB) return 'B';
    return 'A';
  }

  repeat(ev, i) {
    const keypressed = ev.ctrlKey || ev.altKey;

    if (keypressed) {
      if (this.repeatA >= 0) {
        this.repeatB = i;
        if (this.repeatB < this.repeatA) {
          this.repeatB = this.repeatA;
          this.repeatA = i;
        }

        if (
          this.currentLineNum > this.repeatB ||
          this.currentLineNum < this.repeatA
        ) {
          this.seekToLine(this.repeatA);
        }
      } else {
        this.repeatA = i;
      }
    } else {
      // repeat a line
      if (i === this.repeatA) {
        this.clearRepeat();
      } else {
        this.repeatA = i;
        this.repeatB = i;
        this.seekToLine(i);
      }
    }
  }
  openSettings() {
    $('app-settings .modal').modal('show');
  }
  changeFontSize(n) {
    $('ul.caption-ul').css('font-size', `${n}px`);
  }
}
