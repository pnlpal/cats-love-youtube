import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { YtbService } from '../ytb.service';
import { FormControl } from '@angular/forms';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

declare var $: any;
declare var ResizeObserver: any;
@Component({
  selector: 'app-caption-man',
  templateUrl: './caption-man.component.html',
  styleUrls: ['./caption-man.component.less']
})
export class CaptionManComponent implements OnInit {
  captionTracks = []
  captionLines = []
  captionLines2 = []
  originalCaptionLines2 = []
  selectedTracks = []
  trackName = ''

  username = localStorage.username || ''
  usernameCtrl = new FormControl()
  invalidUsername = false
  registerred = !!localStorage.username

  commentCtrl = new FormControl()
  currentComment = ""

  repeatA: number 
  repeatB: number 

  currentVid = ''
  currentTime = 0
  currentLine = null
  currentLineNum = 0 
  currentLineTimer = null 
  defaultLanguages = []
  loading = true

  Math = Math

  error = null

  currentLineTop = 0
  settings = {
    darkMode: false,
    timestamp: false, 
    fontSize: 14
  }

  openedShareBefore = false

  constructor(private ytb: YtbService, private cd: ChangeDetectorRef) { 
    if (localStorage.getItem('captionz-settings'))
      this.settings = JSON.parse(localStorage.getItem('captionz-settings'))
  }

  reset() {
    this.captionTracks = [];
    this.captionLines = []; 
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
      .pipe(debounceTime(200),
        distinctUntilChanged())
      .subscribe((username: string) => {
        this.invalidUsername = false;
        this.username = username;        
      });

    this.commentCtrl.valueChanges
      .pipe(debounceTime(200),
        distinctUntilChanged())
      .subscribe((comment: string) => {
        this.currentComment = comment;        
      });

    this.initYtb();
  }

  register() {
    console.log('register user: ', this.username);
    localStorage.username = this.username;
    this.registerred = true 
  }

  comment() {
    console.log('comment: ', this.currentComment);
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
      let l_next = this.captionLines[i+1];
      let l2 = newCaptions[j];
      if (!l2) return;

      if (!this.captionLines2[i]) this.captionLines2[i] = { texts: [] } 

      if (l2.start <= l.start) {
        this.captionLines2[i].texts.push(l2.text);
        j += 1;
        pushSameLines(l, i);
      } else if (l2.start < (l.start + l.dur)) {
        if (!l_next || (l2.start + l2.dur) < (l_next.start + l_next.dur/2)) {
          this.captionLines2[i].texts.push(l2.text);
          j += 1;
          pushSameLines(l, i);
        }
      } else {
        if (l_next && (l2.start + l2.dur) < l_next.start) {
          this.captionLines2[i].texts.push(l2.text);
          j += 1;
          pushSameLines(l, i);
        }
      }
    };
    this.captionLines.forEach((l, i) => {
      pushSameLines(l, i);
    });

    for (let index = j; index < newCaptions.length; index++) {
      this.captionLines2.push({ texts: [newCaptions[index].text] });
    }
  }

  async changeCaption(event, track, vid = null) {    
    const idx = this.selectedTracks.findIndex(t => t.name === track.name)
    if (idx >= 0) {
      this.selectedTracks.splice(idx, 1);
      if (idx === 0) {
        this.captionLines = this.originalCaptionLines2;
      }
      this.genCaption2([]);
      
    } else {
      this.loading = true;

      const captions = await this.ytb.getCaptionLines(this.currentVid, track.languageCode, track.nameProp);
      if (vid && vid !== this.currentVid) return;

      if (event && event.target.nodeName !== 'INPUT' && this.selectedTracks.length) { // replace the track
        this.selectedTracks[this.selectedTracks.length - 1] = track;
      } else {
        this.selectedTracks.push(track);
      }

      if (this.selectedTracks.length === 3)  {
        this.selectedTracks.splice(0, 1);
        this.captionLines = this.originalCaptionLines2;
        this.genCaption2(captions);

      } else if (this.selectedTracks.length === 2) {
        this.genCaption2(captions);
      } else {
        this.captionLines = captions;
      }
    }
    
    this.defaultLanguages = this.selectedTracks.map(t => t.name);
    this.trackName = this.selectedTracks.map(t => t.name).join(', ');
    localStorage.setItem('last-language-names', JSON.stringify(this.defaultLanguages));
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

  async initYtb() {
    this.ytb.videoId.subscribe(async (vid) => {
      console.log('video id: ', vid);
      if (!vid) return;
      this.currentVid = vid;
      this.reset();

      try {
        const tracksResult = await this.ytb.getCaptionTracks();
        if (vid !== this.currentVid) return;
        this.captionTracks = tracksResult;
          
        let backToDefault = true;
        this.defaultLanguages.forEach(name => {
          const track = this.captionTracks.find(n => n.name === name);
          if (track)  {
            backToDefault = false;
            this.changeCaption(null,  track, vid);
          }
        });

        if (backToDefault) {
          const track = this.captionTracks.find(n => n.languageCode === 'en-US') 
            || this.captionTracks.find(n => n.languageCode.startsWith('en'));
          if (track) this.changeCaption(null, track, vid);
          else this.loading = false;
        }
      } catch (err) {
        this.error = err;
        this.loading = false;
      }
    });
    await this.ytb.init();

    const setCaptionsHeight = () => {
      const h = $("#ytb-player").height() - 50;
      $("ul.caption-ul").css('height', `${h}px`);
      if (!this.isSmallScreen())
        this.currentLineTop = h * 2/5;
    }

    setCaptionsHeight();
    new ResizeObserver(setCaptionsHeight).observe($("#ytb-player")[0]);
    this.changeFontSize(this.settings.fontSize);

    this.ytb.onPlaying = (t: number) => {
      if (this.captionLines.length) {
        this.scrollToTime(t);
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
  setLineTimer () {
    clearTimeout(this.currentLineTimer);

    const repeatLastLine = this.currentLineNum === this.repeatB;

    let sec = this.currentLine.start + this.currentLine.dur - this.currentTime + 0.1;
    if (sec < 0.1) sec = 0.1;

    let nextLine = this.captionLines[this.currentLineNum + 1];
    if (nextLine && !repeatLastLine) {
      sec += (nextLine.start - (this.currentLine.start + this.currentLine.dur)) / 2;
      // console.log(`current: ${this.currentTime}, start: ${this.currentLine.start}, dur: ${this.currentLine.dur}, wait: ${sec}`);
    } else if (!nextLine && !repeatLastLine) {
      console.log(`End of line, current: ${this.currentTime}`);
      this.currentLineTimer = null;
      return;
    }

    this.currentLineTimer = setTimeout(() => {
      if (this.currentLineNum === this.repeatB) { // in repeat
        this.seekToLine(this.repeatA);
      } else {
        this.scrollToTime(this.ytb.getCurrentTime());
      }
    }, sec * 1000);
  }
  scrollToLine(idx) {
    if (this.currentLineNum >= 0) {
      $(`ul.caption-ul .list-group-item[data-index="${this.currentLineNum}"]`).removeClass('active');
    }

    this.currentLine = this.captionLines[idx];
    this.currentLineNum = idx;

    if (this.currentLine) {
      // console.log(this.currentLine.text);
      if (this.ytb.playing) this.setLineTimer();

      if (this.repeatB >=0 && !this.isLineInRepeat(this.currentLineNum)) {
        this.clearRepeat();
        this.cd.detectChanges(); // somehow, the changed didn't auto detected.
      }

      const $el = $(`ul.caption-ul .list-group-item[data-index="${this.currentLineNum}"]`);
      $el.addClass('active');
      const el = $el[0];
      if (el) {
        $('ul.caption-ul').scrollTop(el.offsetTop - this.currentLineTop);
      }
    }
  }
  scrollToTime(time: number) {
    const isLineInTime = (currentTime, line, prevL) => {
      if (currentTime >= line.start && currentTime < (line.start + line.dur)) {
        return true;
      } else if (prevL && currentTime >= (prevL.start + prevL.dur) && currentTime < line.start) {
        return true;
      } else if (!prevL && currentTime < line.start) {
        return true;
      }
      return false;
    };

    const findCurrentLineIndex = (currentTime, lastIdx = null) => {
      let start = lastIdx || 0;
      for (let i = 0; i < this.captionLines.length; i++) {
        if (isLineInTime(currentTime, this.captionLines[start], this.captionLines[start - 1]))
          return start;

        start += 1;
        if (start === this.captionLines.length) start = 0;
      }
      return this.captionLines.length - 1;
    };

    this.currentTime = time;
    const idx = findCurrentLineIndex(this.currentTime, this.currentLineNum);
    return this.scrollToLine(idx);
  }

  seekToLine(i) {
    const line = this.captionLines[i];
    this.ytb.seekTo(line.start);

    this.currentTime = line.start;
    this.scrollToLine(i);
  }

  clearRepeat() {
    this.repeatA = NaN;
    this.repeatB = NaN;
  }
  isLineInRepeat(i) {
    return this.repeatA >= 0 && this.repeatB >= 0 && (i >= this.repeatA && i  <= this.repeatB) 
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

        if (this.currentLineNum > this.repeatB || this.currentLineNum < this.repeatA) {
          this.seekToLine(this.repeatA);
        }
      } else {
        this.repeatA = i;
      }
    } else {  // repeat a line
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
