import { enableProdMode } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';

import { AppModule } from './app/app.module';
import { environment } from './environments/environment';

if (environment.production) {
  enableProdMode();
}

platformBrowserDynamic()
  .bootstrapModule(AppModule)
  .catch((err) => console.error(err));

declare var $: any;

(() => {
  const parseUrl = (url: string) => {
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
  };

  const parseParams = (search: string) => {
    const parameters = new URLSearchParams(search);
    const link = parameters.get('link')?.trim();
    if (link) {
      return parseUrl(link);
    } else {
      const videoId = parameters.get('v');
      const playlistId = parameters.get('list');
      const indexInPlaylist = parseInt(parameters.get('index')) - 1;

      return { playlistId, indexInPlaylist, videoId };
    }
  };

  const { videoId } = parseParams(window.location.search);

  $('head meta[property="og:image"]').attr(
    'content',
    'https://i.ytimg.com/vi/' + videoId + '/hqdefault.jpg'
  );
})();
