import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';

import { AppComponent } from './app.component';
import { CaptionManComponent } from './caption-man/caption-man.component';

import { ReactiveFormsModule } from '@angular/forms';
import { UnescapePipe } from './unescape.pipe';
import { SettingsComponent } from './settings/settings.component';
import { MinsecPipe } from './minsec.pipe';
import { SharesComponent } from './shares/shares.component';

@NgModule({
  declarations: [
    AppComponent,
    CaptionManComponent,
    UnescapePipe,
    SettingsComponent,
    MinsecPipe,
    SharesComponent
  ],
  imports: [
    BrowserModule,
    ReactiveFormsModule,
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
