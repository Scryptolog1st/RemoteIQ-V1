import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Param,
    Body,
    ParseUUIDPipe,
} from '@nestjs/common';
import { RolesService } from './roles.service';
import { CreateRoleDto, UpdateRoleDto } from './dto';

@Controller('api/roles')
export class RolesController {
    constructor(private readonly svc: RolesService) { }

    @Get()
    list() {
        return this.svc.list();
    }

    @Post()
    create(@Body() body: CreateRoleDto) {
        return this.svc.create(body);
    }

    @Patch(':id')
    async update(
        @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
        @Body() body: UpdateRoleDto,
    ) {
        await this.svc.update(id, body);
        return { ok: true };
    }

    @Delete(':id')
    async remove(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
        await this.svc.remove(id);
        return { ok: true };
    }
}
