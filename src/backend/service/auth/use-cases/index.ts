import { autoLogin } from "./auto-login/auto-login";
import { login } from "./login/login";
import { logout } from "./logout/logout";
import { registerSocket } from "./register-socket/register-socket";

const authUsecase = { autoLogin, login, logout, registerSocket };
export { authUsecase };
