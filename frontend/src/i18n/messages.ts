// Existing async handlers keep English messages in state. Match only these
// known application templates so switching languages also updates old notices.
// Names, IDs and server details captured from them remain unchanged.
export const messageTemplates = [
  "Created class {value0}",
  "Created assignment '{value0}'",
  "Created contest '{value0}'",
  "Updated class {value0}",
  "Updated assignment '{value0}'",
  "Updated contest '{value0}'",
  "Deleted class {value0}",
  "Deleted assignment '{value0}'",
  "Deleted contest '{value0}'",
  "Created Student account for {value0}",
  "Created Lecturer account for {value0}",
  "Created Admin account for {value0}",
  "Approved lecturer request for {value0}",
  "Rejected lecturer request for {value0}",
  "Successfully imported {value0} users.",
  "Successfully imported {value0} members.",
  "{value0} was added successfully.",
  "Account updated for {value0}.",
  "{value0} was approved as a lecturer.",
  "{value0}'s request was rejected. The reason was not sent because the server does not accept it.",
  "{value0}'s request was rejected.",
  "{value0} semester updated.",
  "A class with ID {value0} already exists.",
  "{value0} was added.",
  "{value0} added to this class.",
  "{value0} removed from this class.",
  "{value0} class details saved.",
  "{value0} assigned to {value1}.",
  "{value0} was deleted.",
  "Enter the 6-digit code sent to {value0}.",
  "Submit a request to become a lecturer on {value0}.",
  "Validation error: {value0}",
  "Enter a score from 0 to {value0}.",
  'Hi! I can help you work through "{value0}". What would you like to ask?',
  "{value0} min",
  "Semester {value0}, {value1}",
  ", {value0} deadlines",
] as const;

export const messagePatterns = messageTemplates.map(key => {
  const names: string[] = [];
  const parts = key.split(/(\{\w+\})/g).map(part => {
    if (/^\{\w+\}$/.test(part)) {
      names.push(part.slice(1, -1));
      return "([\\s\\S]*?)";
    }
    return part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  });
  return { key, names, pattern: new RegExp(`^${parts.join("")}$`) };
});
