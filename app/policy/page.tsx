import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function PolicyPage() {
  return (
    <div className="container py-8">
      <div className="max-w-3xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Privacy Policy</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <section>
              <h2 className="text-xl font-semibold mb-2">1. Information We Collect</h2>
              <p className="text-muted-foreground">
                We collect information that you provide directly to us, including account information, quiz content, and usage data.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-2">2. How We Use Your Information</h2>
              <p className="text-muted-foreground">
                We use the collected information to provide and improve our services, personalize your experience, and communicate with you.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-2">3. Data Security</h2>
              <p className="text-muted-foreground">
                We implement appropriate security measures to protect your personal information from unauthorized access, alteration, or disclosure.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-2">4. Cookies and Tracking</h2>
              <p className="text-muted-foreground">
                We use cookies and similar tracking technologies to track activity on our service and hold certain information.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-2">5. Your Rights</h2>
              <p className="text-muted-foreground">
                You have the right to access, correct, or delete your personal information. You can also opt-out of certain data collection practices.
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  )
} 