import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import { ListDevicesQuery } from "./dto";
import { DevicesService, type Device } from "./devices.service";

@Controller("/api/devices")
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class DevicesController {
  constructor(private readonly devices: DevicesService) { }

  @Get()
  async list(
    @Query() query: ListDevicesQuery
  ): Promise<{ items: Device[]; nextCursor: string | null }> {
    const { pageSize, cursor, q, status, os } = query;
    return this.devices.list({ pageSize, cursor, q, status, os });
  }

  @Get(":id")
  async getOne(@Param("id") id: string): Promise<Device> {
    const dev = await this.devices.getOne(id);
    if (!dev) throw new NotFoundException("Device not found");
    return dev;
  }
}
