import { Component, OnInit } from '@angular/core';
import { Input, Output, EventEmitter } from '@angular/core';
declare var $: any;

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.less']
})
export class SettingsComponent implements OnInit {
  @Input() settings;
  @Output() changeFont = new EventEmitter();

  constructor() { }

  ngOnInit(): void {
    $('input[type="checkbox"]', '.settings-modal').on('change', (e) => {
      // console.log(e.target.checked, e.target.name);
      this.settings[e.target.name] = e.target.checked;
      localStorage.setItem('captionz-settings', JSON.stringify(this.settings));
    })

    $('input[name="fontSize"]', '.settings-modal').on('change', (e) => {
      this.changeFont.emit(e.target.value);
      this.settings[e.target.name] = e.target.value;
      localStorage.setItem('captionz-settings', JSON.stringify(this.settings));
    });
  }
}
