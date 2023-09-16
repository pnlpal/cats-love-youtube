import { Injectable, NgZone } from '@angular/core';
import { Observable, BehaviorSubject } from 'rxjs';
// import {environment} from '../environments/environment';

declare var YT: any;
declare var $: any;

@Injectable({
  providedIn: 'root',
})
export class YtbService {
  player = null;
  playing = false;
  onStartPlaying = null;
  onPaused = null;

  playLink = '';

  bullets = [];

  private _videoId: BehaviorSubject<string> = new BehaviorSubject('');
  public readonly videoId: Observable<string> = this._videoId.asObservable();

  private _playlistId: BehaviorSubject<string> = new BehaviorSubject('');
  public readonly playlistId: Observable<string> =
    this._playlistId.asObservable();

  constructor(private zone: NgZone) {}

  init() {
    return new Promise((resolve, reject) => {
      (window as any).onYouTubeIframeAPIReady = () => {
        this.player = new YT.Player('ytb-player', {
          width: '100%',
          playerVars: {
            playsinline: 1,
          },
          events: {
            onReady: () => {
              console.log('ready.....');

              // for debugging
              (window as any).player = this.player;

              const lastVid =
                localStorage.getItem('last-video-id') || 'J_z-W4UVHkw';
              const lastPlaylistId = localStorage.getItem('last-playlist-id');

              if (lastPlaylistId) {
                this.loadPlaylistById(
                  lastPlaylistId,
                  parseInt(localStorage.getItem('last-video-index-in-playlist'))
                );
                this.player.mute();
              } else if (lastVid) {
                this.loadVideoById(lastVid);
                this.player.mute();
              }

              resolve({ lastPlaylistId, lastVid });
            },
            onStateChange: (ev) => {
              console.log('State Change: ', ev.data);

              if (ev.data === -1 && this._playlistId.getValue()) {
                // When the player first loads a video, it will broadcast an unstarted (-1) event.
                const url = this.player.getVideoUrl();
                const parsed = this.parseUrl(url);
                if (
                  parsed.videoId &&
                  parsed.videoId !== this._videoId.getValue()
                ) {
                  console.log('playlist load video: ', parsed.videoId);
                  this.zone.run(() => {
                    this._videoId.next(parsed.videoId);
                  });
                  localStorage.setItem('last-video-id', parsed.videoId);

                  const idx = this.player.getPlaylistIndex();
                  localStorage.setItem('last-video-index-in-playlist', idx);
                }
              }

              if (ev.data === 1) {
                // playing
                this.playing = true;
                if (this.onStartPlaying) {
                  this.onStartPlaying(this.player.getCurrentTime());
                }
              } else {
                if (this.playing) {
                  if (this.onPaused) {
                    this.onPaused();
                  }
                }
                this.playing = false;
              }
            },
          },
        });
      };

      // 2. This code loads the IFrame Player API code asynchronously.
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    });
  }

  loadVideoById(vid) {
    if (vid != this._videoId.getValue()) {
      this.player.loadVideoById(vid);
      this._videoId.next(vid);
      localStorage.setItem('last-video-id', vid);

      // clear playlist
      this._playlistId.next('');
      localStorage.removeItem('last-playlist-id');
      localStorage.removeItem('last-video-index-in-playlist');
    }
  }
  loadPlaylistById(playlistId, index = 0) {
    if (playlistId != this._playlistId.getValue()) {
      this._playlistId.next(playlistId);
      localStorage.setItem('last-playlist-id', playlistId);
      this.player.loadPlaylist({
        list: playlistId,
        listType: 'playlist',
        index,
      });
    }
  }
  saveLast({ playlistId = '', indexInPlaylist = -1, videoId = '' }) {
    if (playlistId) {
      localStorage.setItem('last-playlist-id', playlistId);
      if (indexInPlaylist) {
        localStorage.setItem(
          'last-video-index-in-playlist',
          String(indexInPlaylist)
        );
      } else {
        localStorage.removeItem('last-video-index-in-playlist');
      }
      return true;
    } else if (videoId) {
      localStorage.setItem('last-video-id', videoId);
      localStorage.removeItem('last-video-index-in-playlist');
      localStorage.removeItem('last-playlist-id');
      return true;
    }

    return false;
  }

  parseUrl(url: string) {
    const regex =
      /(?:https?:\/\/)?(?:youtu\.be\/|(?:www\.|m\.)?youtube\.com\/(?:watch|v|embed)(?:\.php)?(?:\?.*v=|\/))([a-zA-Z0-9\_-]+)/;
    const playListRegex =
      /(?:https?:\/\/)?(?:youtu\.be\/|(?:www\.|m\.)?youtube\.com\/(?:playlist)(?:\.php)?(?:\?.*list=|\/))([a-zA-Z0-9\_-]+)/;

    let m = url.match(regex);
    if (m && m[1]) {
      const m2 = url.match(/list=([a-zA-Z0-9\_-]+)/);
      const playlistId = m2 && m2[1];

      const m3 = url.match(/index=(\d+)/);
      const indexInPlaylist: number = m3 ? parseInt(m3[1]) - 1 : 0;
      return { videoId: m[1], playlistId, indexInPlaylist };
    } else {
      m = url.match(playListRegex);
      if (m && m[1]) {
        const m3 = url.match(/index=(\d+)/);
        const indexInPlaylist: number = m3 ? parseInt(m3[1]) - 1 : 0;
        return { playlistId: m[1], indexInPlaylist };
      }
    }
    return { invalid: true };
  }

  getCurrentTime() {
    return this.player.getCurrentTime();
  }

  seekTo(time) {
    return this.player.seekTo(time, true);
  }

  async getCaptionLines(
    videoId: string,
    languageCode: string,
    nameProp: string
  ) {
    try {
      const data = await $.get(
        `https://www.youtube.com/api/timedtext?lang=${languageCode}&name=${nameProp}&v=${videoId}`
      );

      return $(data)
        .find('text')
        .toArray()
        .map((item, idx) => {
          const start = Number.parseFloat(item.getAttribute('start'));
          const dur = Number.parseFloat(item.getAttribute('dur'));
          const text = item.innerHTML;
          return { start, dur, text };
        });
    } catch (error) {
      console.error(error);
    }
  }

  async requestTracks(videoId: string) {
    const data = await $.get(
      `https://www.youtube.com/api/timedtext?hl=en&type=list&v=${videoId}`
    );
    //Such as: <track id="0" name="" lang_code="ar" lang_original="العربية" lang_translated="Arabic"/>

    return $(data)
      .find('track')
      .toArray()
      .map((item, idx) => {
        let name = item.getAttribute('lang_translated');
        const nameProp = item.getAttribute('name') || '';
        if (nameProp) name += ' - ' + nameProp;

        return {
          name,
          nameProp,
          nameLocal: item.getAttribute('lang_original'),
          languageCode: item.getAttribute('lang_code'),
        };
      });
  }
}
