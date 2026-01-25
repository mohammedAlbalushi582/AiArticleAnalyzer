'use client'

import { Button } from "@/components/ui/button";
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Input } from "@/components/ui/input"
import { useSession } from "next-auth/react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { z } from "zod";

// ✅ Define schema
const formSchema = z.object({
  articleUrl: z.string().url('Must be a valid URL').min(1, 'URL is required'),
});

// ✅ Get TypeScript type from schema
type FormValues = z.infer<typeof formSchema>

export default function Home() {
  const { data: session, status } = useSession();

  // ✅ Connect zodResolver to form
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      articleUrl: '',
    },
  })

  // ✅ Use proper type
  const onSubmit = async (data: FormValues) => {
    try {
      const payload = {
        ...data,
        userId: session?.djangoId || "1", // Use session user if available
        timestamp: new Date().toISOString()
      };

      const response = await fetch('http://localhost:8000/api/posts/', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          // ✅ Add auth token if using JWT
          'Authorization': `Bearer ${session?.accessToken}`
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        throw new Error('Failed to submit')
      }

      const result = await response.json()
      console.log('Success:', result)
      
      form.reset()
    } catch (error) {
      console.error('Error:', error)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Form {...form}>
        {/* ✅ Connect onSubmit here */}
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4 w-full max-w-md px-4">
          <FormField
            control={form.control}
            name="articleUrl"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Article URL</FormLabel>
                <FormControl>
                  <Input 
                    placeholder="https://example.com/article" 
                    {...field} 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <Button 
            type="submit" 
            disabled={form.formState.isSubmitting}
          >
            {form.formState.isSubmitting ? 'Submitting...' : 'Submit'}
          </Button>
        </form>
      </Form>
    </div>
  )
}
