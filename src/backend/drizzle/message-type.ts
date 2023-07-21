type MessagePayload = {
  text: {
    forwarded: boolean;
    content: string;
  };
  picture: {
    filename: string;
    forwarded: boolean;
    url: string;
    caption: string;
    /** size in number of bytes */
    size: number;
  };
  file: {
    filename: string;
    forwarded: boolean;
    url: string;
    caption: string;
    /** size in number of bytes */
    size: number;
  };
};

export type Message = {
  [k in keyof MessagePayload]: { type: k } & MessagePayload[k];
}[keyof MessagePayload];
