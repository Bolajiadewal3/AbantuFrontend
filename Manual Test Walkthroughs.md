**Test One**
Title: Incorrect login password
Action: Deliberately input wrong password at login
Expected Output: Some sort of invalid password message
Real Output: "Authentication Error. Invalid email or password."
Change Required: N/A

**Test Two**
Title: Correct login password
Action: Deliberately input right password at login
Expected Output: Instant login to Dashboard
Real Output: Login to Dashboard
Change Required: N/A

**Observation One**
The menu button is working and shows the correct options

**Observation Two**
Clicking shift calendar day correctly opens create shift modal

**Observation Three**
Weekly hours is showing correctly

**Observation Four**
Current week correctly shows on open of shift page

**Observation Five**
Shifts show as draft; accepted or pending - but draft shifts need a greater visual difference

**Test Three**
Title: Retroactive shift creation
Action: Deliberately make a shift with a start time earlier on current day
Expected Output: Should not allow (unless in as of yet not implemented super audit mode)
Real Output: Allows creation of shift that then cannot be clocked into by carers but can be accepted (this is now a bug)
Change Required: Shouldn't allow for creating shifts that have a start time earlier in the current day; need to be made in advance unless in some sort of super audit admin mode

**Test Four**
Title: Unassign clocked in carer
Action: Deliberately unassign clocked in carer
Expected Output: Fail with message
Real Output: "Cannot unassign all carers because one or more carers have already clocked in."
Change Required: N/A

**Observation Six**
Tabs switch correctly

**Test Four**
Title: Past date shift creation
Action: Deliberately create shift in the past
Expected Output: Shouldn't work without being in a super audit mode
Real Output: The shift is able to be made in normal admin mode
Change Required: N/A

**Observation Seven**
Messages seem to be ok with clock out variance showing after deliberately clocking out hours early from carer account

**Observation Eight**
Need to be able to hide older broadcasts and messages after a while so page doesn't balloon

**Observation Nine**
Need to add date of birth and preferred name to service users

**Observation Ten**
Need to be able to remove a service user from a location in a way thats smart with CRUD

**Observation Eleven**
Should remove deactivate option from admin users - should only be able to do so through a terminal line instead

**Observation Twelve**
Service Users need to have required competencies that carers should have in order to be allocated to them

**Observation Thirteen**
Audit might need columns to show data in plain text and how its changed; also need a super audit mode that allows for certain changes by admins that are NOT logged in the audit

**Observation Fourteen**
Theme change to light and to OS settings needs to both be implemented

**Observation Fifteen**
Service users should be able to have a profile picture so carers now who exactly they're looking for

**Observation Sixteen**
When logged in as carer; looking at a location shift should show the location name and then list the people there - not just show the name of a single person there

**Test Five**
Title: Past date shift acceptance
Action: //
Expected Output: Not sure how to handle it yet
Real Output: Allowed acceptance  
Change Required: Need to decide

**Test Six**
Title: Past date shift clock in
Action: //
Expected Output: Should probably fail and say shift is in the past
Real Output: Gave unspecific error message  
Change Required: Need to decide

**Observation Seventeen**
Must disallow requesting cover for a shift if within a certain time period before the clock in time to prevent last minute; but super audit mode needs to allow for swapping the person even in this time by admin just in case of an emergency

**Observation Eighteen**
Care plans and medications need to be saved for each service user in a way that makes sense

**Observation Nineteen**
I think a medicines centre needs to be made akin to the training centre; as one will need to log the MAR charts and PRN charts for the daily administration of medication for each service user to ensure that carers are logging in on the app and in the physical sheets accurately - might need a way to scan in the sheets and smart fill the online charts

**Observation Twenty**
Need to change the clock in and clock out grey prompt to be more akin to "I have logged in the physical record" and to make sure its clear that the carer needs to put a record in the physical service user book

**Observation Twenty One**
Need a system for sending automated emails when a week is published to prompt the carers to log in to their account if they have shifts that need acceptance

**Observation Twenty Two**
Need a smart system for printing out data such as shift calendars etc