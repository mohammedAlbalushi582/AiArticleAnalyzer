import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { AuthForm } from './AuthForm';


const AuthDialog = () => {
  return (
    <Dialog>
      <form>
        <DialogTrigger asChild>
          <Button>Sign In</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogTitle>Login</DialogTitle>
            <AuthForm />
        </DialogContent>
      </form>
    </Dialog>
)
}

export default AuthDialog
