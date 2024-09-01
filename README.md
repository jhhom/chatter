# 💬 Chatter

Chatter is an instant messaging application (WhatsApp/Telegram clone) with a full-suite of features.

Built with ReactJS and NodeJS.

## Table of contents

- [1. 📱 Features](#1--features)
- [2. 🖼️ Screenshots](#2-️-screenshots)
- [3. 💻 Technical highlights](#3--technical-highlights)
  - [1. Custom synchronous communication layer over WebSocket](#1-custom-synchronous-communication-layer-over-websocket)
  - [2. Front-end application architecture](#2-front-end-application-architecture)
  - [3. Messages caching](#3-messages-caching)
  - [4. Mocking of sockets for automated/exploratory testing](#4-mocking-of-sockets-for-automatedexploratory-testing)
  - [5. Type-safe contract](#5-type-safe-contract)
- [4. 🛠️ Development instructions](#4-️-development-instructions)
- [5. 📊 To seed database](#5--to-seed-database)
- [6. ⚙️ Configurations](#6-️-configurations)
  - [Configurations specifications](#configurations-specifications)
  - [1. Back-end and asset server](#1-back-end-and-asset-server)
  - [2. Front-end](#2-front-end)

## 1. 📱 Features

[🔼 Table of Contents](#table-of-contents)

**Feature 1 - Notification**

- Feature 1.1 - Online Presence
- Feature 1.2 - Typing Notification

<br/>

**Feature 2 - Send Message**

- Feature 2.1 - Message Read Notification
- Feature 2.2 - Send rich text, multi-line text message
- Feature 2.3 - Send picture
- Feature 2.4 - Send file
- Feature 2.5 - Reply to message
- Feature 2.6 - Forward message
- Feature 2.7 - Delete message

<br/>

**Feature 3 - Group Messaging: Create Group**

- Feature 3.1(a) - Add people to group: Direct invite
- Feature 3.1(b) - Add people to group: Using invite link
- Feature 3.2(a) - Group Activity Notifications (Online)
- Feature 3.2(b) - Group Activity Notifications (Typing)
- Feature 3.3 - Remove member from group
- Feature 3.4 - Leave group

<br/>

**Feature 4 - Permissions**

- Feature 4.1 - General Permissions
- Feature 4.1(a) - Join Permission
- Feature 4.1(b) - Read Permission
- Feature 4.1(c) - Write Permission
- Feature 4.1(d) - Get Notified Permission
- Feature 4.2(a) - Group Messaging Permissions - Share Permission
- Feature 4.2(b) - Delete Permission
- Feature 4.2(c) - Administer Permission

<br/>

**Feature 5 - Add Contact**

## 2. 🖼️ Screenshots

[🔼 Table of Contents](#table-of-contents)

<p style="font-weight: 700" align="center">
    <b>Sending message</b>
</p>

<div style="border: 1px solid black" align="center">
    <img style="width: 80%;" src="/docs/media/chatter-1.png">
</div>

<br/>

---

<p style="font-weight: 700" align="center">
    <b>Group member action permissions setting</b>
</p>

<div style="border: 1px solid black" align="center">
    <img style="width: 80%;" src="/docs/media/chatter-2-security.png">
</div>

<br/>

---

<p style="font-weight: 700" align="center">
    <b>Invite link</b>
</p>

<div style="border: 1px solid black" align="center">
    <img style="width: 80%;" src="/docs/media/chatter-3-invite-links.png">
</div>

<br/>

---

<p style="font-weight: 700" align="center">
    <b>Add contacts</b>
</p>

<div style="border: 1px solid black" align="center">
    <img style="width: 80%;" src="/docs/media/chatter-4-add-contact.png">
</div>

<br/>

---

<p style="font-weight: 700" align="center">
    <b>Create group</b>
</p>

<div style="border: 1px solid black" align="center">
    <img style="width: 80%;" src="/docs/media/chatter-5-new-group.png">
</div>

<br/>

---

<p style="font-weight: 700" align="center">
    <b>Add members to group</b>
</p>

<div style="border: 1px solid black" align="center">
    <img style="width: 80%;" src="/docs/media/chatter-6-add-members.png">
</div>

<br/>

---

<p style="font-weight: 700" align="center">
    <b>Send picture</b>
</p>

<div style="border: 1px solid black" align="center">
    <img style="width: 80%;" src="/docs/media/chatter-7-picture.png">
</div>

<br/>

---

<p style="font-weight: 700" align="center">
    <b>Block peer</b>
</p>

<div style="border: 1px solid black" align="center">
    <img style="width: 80%;" src="/docs/media/chatter-8-block.png">
</div>

<br/>

---

## 3. 💻 Technical highlights

[🔼 Table of Contents](#table-of-contents)

### 1. Custom synchronous communication layer over WebSocket

When I try to implement login, one challenge I face is how to update the UI after user login, based on whether the login is successful or not.

The requirement is:

> When user enters correct email and password, the login will be successful and user will be redirected to the home page
>
> When user enters wrong email or password, the login will be unsuccessful and an error message should be shown to the user
>
> After user submits the credentials, there should be some loading indicator letting the user know that it is waiting for the result from the server

Unlike HTTP requests which always expect an HTTP response, WebSocket communication is fire-and-forget. This means I send a message with the WebSocket, and I don't expect a response. The server can send me messages every once in a while. However by itself, this message is not associated as a reply to any message I sent.

This is a problem because after the user login, when and how do we know that the login is successful? We need to listen to a login successful message from the server, and even after we received that message, we don't know if the response belongs to which login attempt if the user attempt multiple logins while we're waiting for the result from the server.

Thankfully, the TRPC framework support a request-response model over communication using WebSocket, it also supports asynchronous messaging with subscription.

![](/docs/media/chatter-seq-diagram.png)

Diagram: Synchronous communication protocol on top of WebSocket

If we only use WebSocket, by associating each WebSocket message with a message id, we're able to associate each WebSocket message from the server as a reply to some WebSocket message we sent before as the client.

This allows the client to "wait" for a reply from the server even though WebSocket communication protocol itself don't have the concept of "response" unlike HTTP protocol using "request-response" model.

This can ease the programming model at the front-end.

I learnt about this by referring to the implementation of other open source instant-messaging application: Tinode

### 2. Front-end application architecture

[🔼 Table of Contents](#table-of-contents)

I struggled with the front-end application architecture during the first few times I try to build a chat application.

One of the problems I usually face is how to update a React state after receiving a message from the server. Since the WebSocket message listener callback is only registered once, I have to update all of my UI states in that one callback.

This means I have to keep most UI states global, so that I can initialize and have it available when the callback is registered, and also have it available to my React components.

I also struggle with implementing the correct UI behaviours with the fire-and-forget nature of the WebSocket API's send function, as I was more used to await a result from fetch, and then update the UI. With the fire-and-forget nature, I have no result to await after send, making it difficult to show the correct feedback in the UI after user performs an operation (e.g login).

As I practise more and more, I soon starting to grasp how to organise my codes so that I can keep them co-located and localized to where they are used, while still be able to be updated when server sends a message.

One approach to co-location is to register a callback to react from server's WebSocket message by calling an array of callbacks. This array can be dynamically updated throughout the application, adding and removing callback from this array.

This way any React component or pages throughout the application can register the callback to listen to the WebSocket message they care about.

While the solution the WebSocket fire-and-forget send is described in Synchronous communication over WebSocket.

One way to guide ourself on the architecture and organization while we're working on the codebase, is to have a diagram. The architecture of the front-end instant messaging application can look as follows:

![](/docs/media/architecture.png)

Diagram: A general architecture of the front-end

The state can be global or local. To update local states from WebSocket event listener, the React component hosting the local states will be responsible to register a callback to the WebSocket message event listener.

To accomodate this dynamic registration and deregistration of WebSocket event listener callbacks from anywhere in the application, the registered WebSocket event listener will have to act as a sort of a router, that routes the socket message event to a global dynamic array of handlers that is added and removed throughout the application.

### 3. Messages caching

In an instant messaging application, the volume of messages data can be huge. The retrieval of the messages can quickly overload of the server and the network.

To reduce this load, it is important to implement messaging caching.

In this project, I implemented messaging caching using IndexedDB. One challenge I often face is in keeping the cache in IndexedDB updated (e.g when user deleted a message, or read a message, this has to be notified to the other party, and the other party has to delete this deleted message from their cache, or update the read status).

Another challenge is in accessing IndexedDB reactively, whereby changes will to cache will automatically reflect changes in UI.

### 4. Mocking of sockets for automated/exploratory testing

[🔼 Table of Contents](#table-of-contents)

At the back-end, mocking sockets for testing can significantly reduce the effort in verifying the interaction is correct.

This is not just for the benefit of automated testing, but also for the benefit of exploratory testing.

The front-end of an instant messaging application can be more complicated with a lot of global states, especially when we mix in concerns like caching, which is very common in data-demanding and real-time applications like instant-messaging application.

This additional complexity can lead to bugginess and makes it difficult to verify that the back-end behaviour is correct when testing manually with front-end. When bugs occur, it can be difficult to determine whether it comes from front-end not updating the cache or state correctly, or the back-end is not behaving correctly.

Hence it's important that we can perform exploratory testing to find out any possible bugs at the back-end without having to rely on front-end.

Additionally, in an instant messaging application, many steps and interactions have to be performed to build up state. When performed manually and many times and surely we will as when we're debugging, we are going to repeat the process many times to reproduce the bug and and get feedback (checking if it's solved) at every step towards solving the bug.

For example, to verify if the server is sending read notification when a message has been read, we need to login as one user, then login as another user, sends an unread message, opens the message as another user.

By coding the testing steps, we can reduce a lot of repeated work in reproducing the bug.

While coding can be tedious, with the mocking infrastructure and test helpers in place, it will reduce the work and make the process a much more pleasant experience.

### 5. Type-safe contract

[🔼 Table of Contents](#table-of-contents)

One challenge in any full-stack development is the synchronisation of the API data models on the front-end and the back-end.

I develop iteratively where I found myself very frequently having to delete, rewrite, and refactor a lot of codes when I want to implement a new feature in this project.

Without type-safe contract, the work of keeping the API data models synchronised across front-end and back-end can easily take up a lot of development time.

## 4. 🛠️ Development instructions

[🔼 Table of Contents](#table-of-contents)

For local development, run:

1. Front-end: Run with `pnpm run dev` (Folder: `src/frontend` and `src/app`)
2. Back-end: Run with `pnpm run dev:server` (Folder: `src/backend`)
3. Asset server: Run with `pnpm run dev:asset` (Folder: `src/asset-server`)

## 5. 📊 To seed database

Run `pnpm run scripts:seed-db` from the `src/backend` folder.

## 6. ⚙️ Configurations

[🔼 Table of Contents](#table-of-contents)

Configurations for the back-end and front-end are specified separately.

There may be duplications for both configurations.

### Configurations specifications

1. Back-end and asset server configuration
   - Configuration values: `config/.env`
   - Configuration schema: `src/config/config.ts`
2. Front-end configuration: `src/frontend/config/config.ts`

### 1. Back-end and asset server

Configurations are specified in `config/.env`

Backend: Configurations are loaded in `src/backend/main.ts`.

Asset server: Configurations are loaded in `src/asset-server/main.ts`

The schema of the configuration is in `src/config/config.ts`

```ts
const config = loadConfig();
```

### 2. Front-end

Configurations are specified in `src/frontend/config/config.ts`

The configuration is imported statically into the application.

The configuration of the port running is at `package.json`.

```
next dev -p 6010
```
