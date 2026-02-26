import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { UserPlus, Trash2, Users } from 'lucide-react';
import { EmergencyContact } from '@/types/emergency';
import { toast } from 'sonner';

interface EmergencyContactsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const EmergencyContactsDialog: React.FC<EmergencyContactsDialogProps> = ({
  open,
  onOpenChange,
}) => {
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [newContact, setNewContact] = useState({
    name: '',
    email: '',
    phone: '',
    relationship: '',
  });

  useEffect(() => {
    const saved = localStorage.getItem('emergencyContacts');
    if (saved) {
      setContacts(JSON.parse(saved));
    }
  }, [open]);

  const saveContacts = (updatedContacts: EmergencyContact[]) => {
    localStorage.setItem('emergencyContacts', JSON.stringify(updatedContacts));
    setContacts(updatedContacts);
  };

  const generateId = () => {
    try {
      return crypto.randomUUID();
    } catch {
      return 'id_' + Math.random().toString(36).slice(2, 9);
    }
  };

  const addContact = () => {
    const emailValid = /.+@.+\..+/.test(newContact.email);
    if (!newContact.name || !emailValid) {
      toast.error('Please enter a valid name and email');
      return;
    }

    const contact: EmergencyContact = {
      id: generateId(),
      ...newContact,
    };

    const updated = [...contacts, contact];
    saveContacts(updated);
    setNewContact({ name: '', email: '', phone: '', relationship: '' });
    toast.success(`${contact.name} added to emergency contacts`);
  };

  const removeContact = (id: string) => {
    const updated = contacts.filter(c => c.id !== id);
    saveContacts(updated);
    toast.success('Contact removed');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} modal={false}>
      <DialogContent className="max-w-2xl max-h-[90vh] mx-4 z-[3000]" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Emergency Contacts
          </DialogTitle>
          <DialogDescription>
            Add trusted contacts who will receive your location and status in case of emergency
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Add New Contact Form */}
          <div className="border rounded-lg p-4 space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              Add New Contact
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={newContact.name}
                  onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                  placeholder="Enter contact's full name"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={newContact.email}
                  onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                  placeholder="contact@example.com"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="phone">Phone (Optional)</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={newContact.phone}
                  onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                  placeholder="+91 9876543210"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="relationship">Relationship (Optional)</Label>
                <Input
                  id="relationship"
                  value={newContact.relationship}
                  onChange={(e) => setNewContact({ ...newContact, relationship: e.target.value })}
                  placeholder="e.g., Father, Mother, Spouse, Friend"
                />
              </div>
            </div>
            
            <Button onClick={addContact} className="w-full">
              <UserPlus className="h-4 w-4 mr-2" />
              Add Contact
            </Button>
          </div>

          {/* Contacts List */}
          <div className="space-y-2">
            <h3 className="font-semibold">
              Your Emergency Contacts ({contacts.length})
            </h3>
            
            <ScrollArea className="h-[300px] rounded-lg border p-4">
              {contacts.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No emergency contacts added yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {contacts.map((contact) => (
                    <div
                      key={contact.id}
                      className="flex items-start justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex-1">
                        <div className="font-semibold">{contact.name}</div>
                        <div className="text-sm text-muted-foreground">{contact.email}</div>
                        {contact.phone && (
                          <div className="text-sm text-muted-foreground">{contact.phone}</div>
                        )}
                        {contact.relationship && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {contact.relationship}
                          </div>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeContact(contact.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EmergencyContactsDialog;
