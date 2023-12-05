//
//  FFFastMoneyStateMachine.swift
//  FeudKit
//
//  Created by Cameron Slash on 11/30/23.
//

import Foundation

public class FFFastMoneyStateMachine: AbstractFFStateMachine<FFFastMoneyStateType, FFFastMoneyState> {
    private var fastmoney: FastMoney
    
    public init(fastmoney: FastMoney) {
        self.fastmoney = fastmoney
        super.init(name: "FFGame.FastMoney")
    }
    
    public override func initialize() {
        self.addState(name: FFFastMoneyStateType.P1_ANSWER.description, state: FFFastMoneyStateFactory.getState(type: FFFastMoneyStateType.P1_ANSWER, data: self.fastmoney))
        self.addState(name: FFFastMoneyStateType.P1_REVEAL.description, state: FFFastMoneyStateFactory.getState(type: FFFastMoneyStateType.P1_REVEAL, data: self.fastmoney))
        self.addState(name: FFFastMoneyStateType.P2_ANSWER.description, state: FFFastMoneyStateFactory.getState(type: FFFastMoneyStateType.P2_ANSWER, data: self.fastmoney))
        self.addState(name: FFFastMoneyStateType.P2_REVEAL.description, state: FFFastMoneyStateFactory.getState(type: FFFastMoneyStateType.P2_REVEAL, data: self.fastmoney))
        
        fastmoney.reset()
        _ = self.changeState(name: FFFastMoneyStateType.P1_ANSWER.description)
    }
    
    public override func validateStateTransition(currentState: FFFastMoneyState?, nextState: String) -> Bool {
        if let currentState {
            switch currentState.getType() {
            case FFFastMoneyStateType.P1_ANSWER:
                if (self.fastmoney.allAnswered(player: 0) && nextState == FFFastMoneyStateType.P1_REVEAL.description) { return true }
            case FFFastMoneyStateType.P1_REVEAL:
                return nextState == FFFastMoneyStateType.P2_ANSWER.description
            case FFFastMoneyStateType.P2_ANSWER:
                if (self.fastmoney.allAnswered(player: 1) && nextState == FFFastMoneyStateType.P2_REVEAL.description) { return true }
            default:
                return false
            }
            
            return false
        }
        return false
    }
    
    public func getCurrentStateType() -> FFFastMoneyStateType? {
        if let currentState {
            return currentState.getType()
        }
        return nil
    }
}
