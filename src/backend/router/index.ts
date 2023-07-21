import { mainRouter } from "~/backend/router/router";

export const appRouter = mainRouter;

export type IAppRouter = typeof appRouter;

// if let's say that we want to make the 'emit' function as a dependency, so that we could swap it
// or maybe observable as a dependency, how would we do it?
// our function will need to return an Observable
// which receives an Emit function
// but we want to check which value is sent through the Emit function, what kind of Observable shall we return?
// if let's say that we want to mock 'emit' function to instead of sending value through a socket
// we need to mock observable as well, because 'emit' is passed by observable
// unfortunately 'observable' is too complicated to mock
// what if we do it this way?
// we know that function given to observable is executed right away
// in our Subscription service, instead of returning an observable, we return the function to be passed inside Observable
// The emit interface is quite easy to mock
// in the actual Subscription procedure, we call our service, then get the return value (a function), and pass it to observable
// How to test our Subscription service?
// Since we know that the function inside the Subscription observable is executed right away (when subscription API is hit)
// In our test, we can simply take the function returned by Subscription service and execute it immediately
// We will pass a mock `emit` function that has a mock `next` function which just adds message to an array rather than send it
// When user unsubscribes, in our tests, we just simulate it by calling all the return function in our observable function call
