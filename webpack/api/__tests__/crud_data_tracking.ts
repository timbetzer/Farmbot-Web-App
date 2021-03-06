jest.mock("../maybe_start_tracking", () => {
  return { maybeStartTracking: jest.fn() };
});

let mockBody = {};
jest.mock("axios", () => {
  return {
    default: {
      delete: () => Promise.resolve({}),
      post: () => Promise.resolve({ data: mockBody }),
      put: () => Promise.resolve({ data: mockBody })
    }
  };
});
import { destroy, saveAll, initSave } from "../crud";
import { buildResourceIndex } from "../../__test_support__/resource_index_builder";
import { createStore, applyMiddleware } from "redux";
import { resourceReducer } from "../../resources/reducer";
import thunk from "redux-thunk";
import { ReduxAction } from "../../redux/interfaces";
import { maybeStartTracking } from "../maybe_start_tracking";
import { API } from "../api";
import { betterCompact } from "../../util";
import { SpecialStatus } from "farmbot";
import * as _ from "lodash";

describe("AJAX data tracking", () => {
  API.setBaseUrl("http://blah.whatever.party");
  const initialState = { resources: buildResourceIndex() };
  const wrappedReducer =
    (state: typeof initialState, action: ReduxAction<void>) => {
      return { resources: resourceReducer(state.resources, action) };
    };

  const store = createStore(wrappedReducer, initialState, applyMiddleware(thunk));
  const resources = () =>
    betterCompact(Object.values(store.getState().resources.index.references));

  it("sets consistency when calling destroy()", () => {
    const uuid = store.getState().resources.index.byKind.Tool[0];
    store.dispatch(destroy(uuid) as any);
    expect(maybeStartTracking).toHaveBeenCalled();
  });

  it("sets consistency when calling saveAll()", () => {
    const r = resources().map(x => {
      x.specialStatus = SpecialStatus.DIRTY;
      return x;
    });
    store.dispatch(saveAll(r) as any);
    expect(maybeStartTracking).toHaveBeenCalled();
    const uuids: string[] =
      _.uniq((maybeStartTracking as jest.Mock).mock.calls
        .map((x: string[]) => x[0]));
    expect(uuids.length).toEqual(r.length);
  });

  it("sets consistency when calling initSave()", () => {
    mockBody = resources()[0].body;
    store.dispatch(initSave(resources()[0]) as any);
    expect(maybeStartTracking).toHaveBeenCalled();
  });
});
