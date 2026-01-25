import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input"


export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex flex-col gap-4 w-full max-w-md px-4">
        <Input 
          type="text" 
          placeholder="Enter your article link"
        />
        <Button>Submit</Button>
      </div>
    </div>

  )
}
