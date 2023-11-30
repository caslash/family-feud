//
//  FFStateMachine.swift
//  FeudKit
//
//  Created by Cameron Slash on 11/26/23.
//

import Foundation
import GameKit

public class StateMachine<U: CustomStringConvertible, T: State<U>> {
    private final var name: String
    
    internal var currentState: T?
    
    internal var states: [String: T] = [String: T]()
    
    public init(name: String) {
        self.name = name
    }
    
    public func getName() -> String{ return self.name }
    
    public func initialize() { }
    
    public func validateStateTransition(currentState: T, nextState: String) -> Bool { return true }
    
    public func addState(name: String, state: T) { states.updateValue(state, forKey: name) }
    
    public func getCurrentStateName() -> String {
        if let currentState { return currentState.description }
        return "nil"
    }
    
    public func getCurrentState() -> T? { return currentState }
    
    public func removeState(name: String) { states.removeValue(forKey: name) }
    
    public func changeState(name: String) -> Bool {
        if validateStateTransition(currentState: currentState!, nextState: name) {
            if currentState != nil && !currentState!.canAdvance(nextState: name) {
                if getDebugMode() { self.printErr(message: "> Invalid state transition: <\(currentState?.description ?? "nil")> is not complete and cannot advance to <\(name)>") }
            } else {
                if let currentState { currentState.cleanupState() }
                if states.contains(where: { $0.key.caseInsensitiveCompare(name) == .orderedSame }) {
                    if getDebugMode() { printTransition(message: "\(self.getName()) > CHANGING STATE from <\(currentState?.description ?? "nil")> to <\(name)>") }
                    var data: Any? = nil
                    if let currentState { data = currentState.getData() }
                    currentState = states[name]
                    currentState?.initState(data: data!)
                    return true
                } else {
                    currentState = nil
                }
            }
        } else {
            if getDebugMode() { printErr(message: "\(self.getName()) > Invalid state transition: <\(currentState?.description ?? "nil")> to <\(name)>") }
        }
        return false
    }
    
    public func update(timeElapsed: Float) {
        if let currentState {
            currentState.updateState(timeElapsed: timeElapsed)
            if currentState.nextState() != nil {
                _ = self.changeState(name: currentState.nextState()!)
            }
        }
    }
    
    internal func getDebugMode() -> Bool { return true }
    
    internal func printLog(message: String) { print(message) }
    
    internal func printTransition(message: String) { print(message) }
    
    internal func printErr(message: String) { print(message) }
}
