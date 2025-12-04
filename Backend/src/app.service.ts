import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { uptime } from 'process';
import pkg from "../package.json"
import { GlobalResponse } from './common/global/global-response.dto';

@Injectable()
export class AppService {
  constructor(
    private readonly configService: ConfigService,
  ) { };
  getInfo() {
    const response: GlobalResponse = {};
    response.title = "Running";
    response.message = pkg.description

    let runningtime: number | string = Math.round(uptime());
    runningtime = ((runningtime < 60)
      ? runningtime + " Seconds"
      : ((runningtime >= 60 && runningtime < 3600)
        ? (Math.floor((runningtime / 60) * 100) / 100) + " Minutes"    // 분
        : (Math.floor((runningtime / 3600) * 100) / 100) + " Hours")); // 시

    response.data = {
      version: pkg.version,
      timestamp: new Date(),
      uptime: runningtime,
      canvasInfo: {
        sizeX: parseInt(this.configService.get("CANVAS_SIZE_X") ?? "500"),
        sizeY: parseInt(this.configService.get("CANVAS_SIZE_Y") ?? "500"),
        totalSize: parseInt(this.configService.get("CANVAS_SIZE_X") ?? "500") * parseInt(this.configService.get("CANVAS_SIZE_Y") ?? "500"),
      }
    }
    
    return response;
  }
}
