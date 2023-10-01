import { Component, OnInit } from '@angular/core';
import { YtbService } from '../ytb.service';

declare var needShareButton: any;

@Component({
  selector: 'app-shares',
  templateUrl: './shares.component.html',
  styleUrls: ['./shares.component.less'],
})
export class SharesComponent implements OnInit {
  imgSrc = '';
  shareUrl = '';
  iframeCode = '';

  constructor(private ytb: YtbService) {}

  ngOnInit(): void {
    new needShareButton('#i-share');

    this.ytb.videoId.subscribe(async (vid) => {
      if (this.ytb.playLink && vid) {
        // console.log('videoId change: ', this.ytb.playLink);
        const parsed = this.ytb.parseUrl(this.ytb.playLink);
        this.imgSrc =
          'https://i.ytimg.com/vi/' + parsed.videoId + '/hqdefault.jpg';
        this.shareUrl =
          'https://pnlpal.dev/cats-love-youtube?link=' +
          encodeURIComponent(this.ytb.playLink);
        this.iframeCode = `<iframe src='https://pnlpal.dev/cats-love-youtube-ii/?link=${encodeURIComponent(
          this.ytb.playLink
        )}' width='100%' frameborder='0' onload='this.style.height=this.offsetWidth > 768 ? (this.offsetWidth/2.67) +"px" : (this.offsetWidth/(16/9)+180)+"px";' allowfullscreen></iframe>`;
      } else if (vid) {
        this.imgSrc = 'https://i.ytimg.com/vi/' + vid + '/hqdefault.jpg';
        const link = 'https://www.youtube.com/watch?v=' + vid;
        this.shareUrl =
          'https://pnlpal.dev/cats-love-youtube?link=' +
          encodeURIComponent(link);
        this.iframeCode = `<iframe src='https://pnlpal.dev/cats-love-youtube-ii/?link=${encodeURIComponent(
          link
        )}' width='100%' frameborder='0' onload='this.style.height=this.offsetWidth > 768 ? (this.offsetWidth/2.67) +"px" : (this.offsetWidth/(16/9)+180)+"px";' allowfullscreen></iframe>`;
      }
    });
  }
}
