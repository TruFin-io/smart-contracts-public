/* eslint-disable @typescript-eslint/no-explicit-any */
import { expect } from "chai";
import { zeroPadValue } from "ethers";

import { loadFixture } from "../helpers/connection";
import { deployment } from "../helpers/fixture";

describe("Delegate registry", () => {
  let one, two, staker, delegateRegistry;
  let stakerAddress;
  beforeEach(async () => {
    // reset to fixture
    ({ one, two, staker, delegateRegistry } = await loadFixture(deployment));
    stakerAddress = await staker.getAddress();
    await staker.setDelegateRegistry(delegateRegistry);
  });

  describe("setGovernanceDelegation", async () => {
    it("Clears delegation with no delegates", async () => {
      const tx = await staker.setGovernanceDelegation("test", [], 123);

      // get the DelegateRegistry events
      const receipt = await tx.wait();
      const delegateRegistryEvents = getDelegateRegistryEvents(receipt);

      // verify DelegateRegistry was called by checking that the DelegationCleared event was emitted
      expect(delegateRegistryEvents.length).to.equal(1);
      const event = delegateRegistryEvents[0];
      expect(event.name).to.equal("DelegationCleared");
      expect(event.args.account).to.equal(stakerAddress);
      expect(event.args.context).to.equal("test");

      // verify the GovernanceDelegationCleared event was emitted by the staker
      await expect(tx).to.emit(staker, "GovernanceDelegationCleared").withArgs("test");
    });

    it("Sets delegate", async () => {
      const delegations = [
        [zeroPadValue(one.address, 32), 1n],
        [zeroPadValue(two.address, 32), 2n],
      ];

      const tx = await staker.setGovernanceDelegation("test", delegations, 123);

      // get the DelegateRegistry events
      const receipt = await tx.wait();
      const delegateRegistryEvents = getDelegateRegistryEvents(receipt);

      // verify DelegateRegistry was called by checking that the DelegationUpdated event was emitted
      expect(delegateRegistryEvents.length).to.equal(1);
      const event = delegateRegistryEvents[0];
      expect(event.name).to.equal("DelegationUpdated");
      expect(event.args.account).to.equal(stakerAddress);
      expect(event.args.context).to.equal("test");
      expect(event.args.expirationTimestamp).to.equal(123);
      expect(event.args.delegation.map((d: any) => d[0].toLowerCase())).to.deep.equal(
        delegations.map((d: any) => d[0].toLowerCase()),
      );

      // verify the GovernanceDelegationSet event was emitted by the staker
      await expect(tx).to.emit(staker, "GovernanceDelegationSet").withArgs("test", delegations, 123);
    });
  });

  function getDelegateRegistryEvents(receipt: any) {
    return receipt.logs
      .map((log) => {
        try {
          return delegateRegistry.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .filter((e) => e !== null);
  }
});
