import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { uptime } from 'process';
import pkg from "../package.json"

@Injectable()
export class AppService {
  constructor(
    private readonly configService: ConfigService,
  ) { };
  getInfo() {
    return {
      status: "Running",
      timestamp: new Date(),
      uptime: Math.round(uptime()) + " seconds",
      version: pkg.version,
      description: pkg.description,
      canvasInfo: {
        sizeX: parseInt(this.configService.get("CANVAS_SIZE_X") ?? "500"),
        sizeY: parseInt(this.configService.get("CANVAS_SIZE_Y") ?? "500"),
        totalSize: parseInt(this.configService.get("CANVAS_SIZE_X") ?? "500") * parseInt(this.configService.get("CANVAS_SIZE_Y") ?? "500"),
      }
    };
  }
}
