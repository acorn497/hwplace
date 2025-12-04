import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { GlobalResponse } from './common/global/global-response.dto';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) { }

  @Get()
  getHello() {
    return this.appService.getInfo();
  }

  @Get('/ping')
  ping() {
    return this.appService.ping();
  }
}
