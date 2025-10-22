//backend\src\users\users.module.ts

import { Module, MiddlewareConsumer } from "@nestjs/common";
import { StorageModule } from "../storage/storage.module";
import { AuthModule } from "../auth/auth.module";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";
import { MeController } from "./me.controller";
import { MeService } from "./me.service";
import { AuthCookieGuard } from "../auth/auth-cookie.guard";

// NEW: Security endpoints
import { SecurityController } from "./security.controller";
import { SecurityService } from "./security.service";

// If you want middleware-level cookie decode, you can also import it:
// import { AuthCookieMiddleware } from "../auth/auth-cookie.middleware";

@Module({
    imports: [StorageModule, AuthModule],
    controllers: [UsersController, MeController, SecurityController],
    providers: [UsersService, MeService, SecurityService, AuthCookieGuard],
    exports: [UsersService, MeService, SecurityService],
})
export class UsersModule {
    // If you prefer middleware for /api/users/me/*, uncomment below and add AuthCookieMiddleware to providers in AuthModule
    // configure(consumer: MiddlewareConsumer) {
    //   consumer.apply(AuthCookieMiddleware).forRoutes(SecurityController, MeController);
    // }
}
