import { autoLogin } from "~/backend/service/auth/auto-login.service";
import { login } from "~/backend/service/auth/login.service";
import { logout } from "~/backend/service/auth/logout.service";
import { registerSocket } from "~/backend/service/auth/register-socket.service";

const authUsecase = { autoLogin, login, logout, registerSocket };
export { authUsecase };
